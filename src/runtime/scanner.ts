import type GroupCommand from "../api/command/GroupCommand.ts";
import type GlobalModifierCommand from "../api/command/GlobalModifierCommand.ts";
import getLogger from "../util/logger.ts";
import type Command from "../api/command/Command.ts";
import type SubCommand from "../api/command/SubCommand.ts";
import { isGroupCommand } from "./command/CommandTypeGuards.ts";

const logger = getLogger("scanner");

/**
 * A result from scanning arguments for commands.
 */
export interface CommandClause {
  /**
   * The {@link Command} referenced as an argument.
   */
  command: Command;

  /**
   * Optional parent {@link GroupCommand} if {@link command} is a member {@link SubCommand}.
   */
  groupCommand?: GroupCommand;

  /**
   * The potential arguments for the discovered {@link Command}.
   */
  potentialArgs: Array<string>;
}

/**
 * A container holding the result of a scan operation.
 *
 * At most one of {@link nonModifierCommandClause} or {@link globalModifierCommandClauses} will be populated.
 * If none are populated then this means no command was found when scanning the provided arguments.
 */
export interface ScanResult {
  /**
   * Optional clause containing a non-modifier {@link Command} found in the arguments.
   */
  nonModifierCommandClause?: CommandClause;

  /**
   * Optional clause containing a list of {@link GlobalModifierCommand} instances found in the arguments.
   */
  globalModifierCommandClauses?: Array<CommandClause>;

  /**
   * Any sequences of arguments which were unused in the scanning operation.
   *
   * As the scanning starts at the beginning of each provided argument sequence and a command clause is demarcated
   * by a matching {@link Command} name (or {@link GlobalCommand} short alias), this will
   * effectively be the leading argument sequences from those provided before the first {@link Command} was identified
   * and any subsequent argument sequences which were not consumed by an identified {@link Command}.
   */
  unusedArgSequences: Array<ReadonlyArray<string>>;
}

function normaliseFirstArgumentIfRequired(
  args: Array<string>,
  globalCommandsByName: ReadonlyMap<string, Command>,
  globalCommandsByShortAlias?: ReadonlyMap<string, Command>,
): Array<string> {
  const firstArg = args[0];

  // only looking for:
  // --<global_[modifier_]command_name>
  // --<global_[modifier_]command_name>=<value>
  // -<global_[modifier_]command_short_alias>
  // -<global_[modifier_]command_short_alias>=<value>
  if ((firstArg.length < 2) || (firstArg.charAt(0) !== "-")) {
    return args;
  }

  // looking for:
  // --<global_[modifier_]command_name>
  // --<global_[modifier_]command_name>=<value>
  if ((firstArg.length > 2) && (firstArg.charAt(1) === "-")) {
    let potentialGlobalCommandName = firstArg.slice(2);

    // looking for:
    // <global_command_name>=<value>
    // <global_modifier_command_name>=<value>
    let nextArg: string | undefined;
    if (potentialGlobalCommandName.includes("=")) {
      [potentialGlobalCommandName, nextArg] = potentialGlobalCommandName.split(
        /=(.*)/,
      );
    }

    if (!globalCommandsByName.has(potentialGlobalCommandName)) {
      // nothing changed
      return args;
    }
    if (!nextArg) {
      // nothing changed
      return args;
    }
    logger.debug(() =>
      `Normalised arg: '${firstArg}' to: '--${potentialGlobalCommandName} ${nextArg}'`
    );
    return [`--${potentialGlobalCommandName}`, nextArg, ...args.slice(1)];
  }

  // looking for:
  // -<global_[modifier_]command_short_alias>
  // -<global_[modifier_]command_short_alias>=<value>
  // (by now we know the arg starts with -<char>)
  let potentialGlobalCommandShortAlias = firstArg.slice(1);

  // looking for:
  // <global_[modifier_]command_short_alias>=<value>
  let nextArg: string | undefined;
  if (potentialGlobalCommandShortAlias.includes("=")) {
    [potentialGlobalCommandShortAlias, nextArg] =
      potentialGlobalCommandShortAlias.split(/=(.*)/);
  }

  if (!globalCommandsByShortAlias) {
    // nothing changed
    return args;
  }

  // looking for <global_[modifier_]command_short_alias>
  const globalCommand = globalCommandsByShortAlias.get(
    potentialGlobalCommandShortAlias,
  );
  if (!globalCommand) {
    // nothing changed
    return args;
  }

  if (nextArg) {
    logger.debug(() =>
      `Normalised arg: '${firstArg}' to: '--${globalCommand.name} ${nextArg}'`
    );
    return [`--${globalCommand.name}`, nextArg, ...args.slice(1)];
  }
  logger.debug(() =>
    `Normalised arg: '${firstArg}' to: '--${globalCommand.name}'`
  );
  return [`--${globalCommand.name}`, ...args.slice(1)];
}

function scanForNextCommandClause(
  potentialArgs: ReadonlyArray<string>,
  includeSubCommands: boolean,
  commandsByName: ReadonlyMap<string, Command>,
  globalCommandsByShortAlias?: ReadonlyMap<string, Command>,
  groupAndMemberCommandsByJoinedName?:
    | ReadonlyMap<string, { groupCommand: GroupCommand; command: SubCommand }>
    | undefined,
): {
  commandClause: CommandClause | undefined;
  unusedArgs: Array<string>;
} {
  let pendingArgs = [...potentialArgs];
  const unusedArgs: Array<string> = [];

  while (pendingArgs.length > 0) {
    pendingArgs = normaliseFirstArgumentIfRequired(
      pendingArgs,
      commandsByName,
      globalCommandsByShortAlias,
    );

    // take first argument
    const currentArg = pendingArgs[0];
    pendingArgs = pendingArgs.slice(1);

    // looking for:
    // <global_[modifier_]command_name>
    if (currentArg.startsWith("--")) {
      const potentialCommandName = currentArg.slice(2);

      // check for Global[Modifier]Command name
      const command = commandsByName.get(potentialCommandName);
      if (command) {
        logger.debug(
          "Found global [modifier] command name: %s",
          potentialCommandName,
        );
        return {
          commandClause: {
            command,
            potentialArgs: pendingArgs,
          },
          unusedArgs,
        };
      }
    }
    if (!includeSubCommands || (currentArg[0] === "-")) {
      unusedArgs.push(currentArg);
      continue;
    }

    if (groupAndMemberCommandsByJoinedName) {
      // looking for:
      // <group_command_name>:<member_sub_command_name>
      // <group_command_name> <member_sub_command_name>
      // <sub_command_name>
      let potentialGroupCommandName = currentArg;
      let potentialMemberSubCommandName: string | undefined;
      let potentialMemberCommandNameArgumentUsed = false;

      if (potentialGroupCommandName.includes(":")) {
        // looking for:
        // <group_command_name>:<member_sub_command_name>
        [potentialGroupCommandName, potentialMemberSubCommandName] =
          potentialGroupCommandName.split(":");
      } else if (pendingArgs.length > 0) {
        // looking for:
        // <group_command_name> <member_sub_command_name>
        potentialMemberSubCommandName = pendingArgs[0];
        pendingArgs = pendingArgs.slice(1);
        potentialMemberCommandNameArgumentUsed = true;
      }

      if (potentialMemberSubCommandName !== undefined) {
        const result = groupAndMemberCommandsByJoinedName.get(
          `${potentialGroupCommandName}:${potentialMemberSubCommandName}`,
        );
        if (result && result.command) {
          const { groupCommand, command } = result;
          logger.debug(
            "Found group command name: %s and member sub-command name: %s",
            potentialGroupCommandName,
            potentialMemberSubCommandName,
          );
          return {
            commandClause: {
              command,
              groupCommand,
              potentialArgs: pendingArgs,
            },
            unusedArgs,
          };
        }
      }
      // if group parsing was not needed, revert state if necessary
      if (
        potentialMemberCommandNameArgumentUsed &&
        (potentialMemberSubCommandName !== undefined)
      ) {
        pendingArgs.unshift(potentialMemberSubCommandName!);
      }
    }

    // looking for:
    // <sub_command_name>
    //
    // if we find it is a group command we skip it as we didn't find a member command
    // following it the logic above
    const command = commandsByName.get(currentArg);
    if (command && !isGroupCommand(command)) {
      logger.debug("Found sub-command name: %s", currentArg);
      return {
        commandClause: {
          command,
          potentialArgs: pendingArgs,
        },
        unusedArgs,
      };
    }

    // if we got here we haven't found a command so add the current arg to unused args
    unusedArgs.push(currentArg);
  }
  // if we got here we haven't found a command and we have processed all provided args
  return {
    commandClause: undefined,
    unusedArgs,
  };
}

/**
 * Scan the provided arguments and return any {@link CommandClause} instances discovered based on the provided
 * list of {@link GlobalModifierCommand} instances.
 *
 * @param argSequences the list of argument sequences to scan.
 * @param globalModifierCommandsByName the map of {@link GlobalModifierCommand} instances by name to use when scanning.
 * @param globalModifierCommandsByShortAlias the map of {@link GlobalModifierCommand} instances by short alias to use when scanning.
 */
export function scanForGlobalModifierCommandClauses(
  argSequences: ReadonlyArray<ReadonlyArray<string>>,
  globalModifierCommandsByName: ReadonlyMap<string, GlobalModifierCommand>,
  globalModifierCommandsByShortAlias: ReadonlyMap<
    string,
    GlobalModifierCommand
  >,
): ScanResult {
  logger.debug(() =>
    `Scanning args: '${
      JSON.stringify(argSequences)
    }' for global modifier commands: '${
      Array.from(globalModifierCommandsByName.keys()).join(" ")
    }'`
  );

  const scanResult: ScanResult = {
    unusedArgSequences: [],
  };

  const commandClauses: Array<CommandClause> = [];

  for (const argSequence of argSequences) {
    let lastCommandClause: CommandClause | undefined;
    let args = argSequence;

    while (args.length > 0) {
      const { commandClause, unusedArgs } = scanForNextCommandClause(
        args,
        false,
        globalModifierCommandsByName,
        globalModifierCommandsByShortAlias,
        undefined,
      );

      // any args that weren't used in the current scan are...
      if (unusedArgs.length > 0) {
        if (lastCommandClause) {
          // ... given back to the previous scan result if defined
          lastCommandClause.potentialArgs = unusedArgs;
        } else {
          // ... or added to the unused arg sequences
          scanResult.unusedArgSequences.push(unusedArgs);
        }
      }

      // if we didn't find a command clause all args have been allocated to
      // a previous clause or the unuused arg sequences, so we can stop scanning
      if (!commandClause) {
        break;
      }

      // save the command we found
      commandClauses.push(commandClause);

      // now set the current scan result as the last scan result
      lastCommandClause = commandClause;

      // temporarily take all of the potential args from the last command clause and use them for a potential
      // new command clause, if any args are left over they will be added back to the last command clause
      args = lastCommandClause.potentialArgs;
      lastCommandClause.potentialArgs = [];
    }
  }

  if (commandClauses.length > 0) {
    scanResult.globalModifierCommandClauses = commandClauses;
  }

  logger.debug("scan result: %O", scanResult);

  return scanResult;
}

/**
 * Scan the provided arguments and return the first {@link CommandClause} instance discovered based on the provided
 * list of non-modifier {@link Command} instances.
 *
 * @param argSequences the list of argument sequences to scan.
 * @param nonModifierCommandsByName the map of non-modifier {@link Command} instances by name to use when scanning.
 * @param globalCommandsByShortAlias optional map of {@link GlobalCommand} instances by short alias to use when scanning.
 * @param groupAndMemberCommandsByJoinedName optional map of {@link GroupCommand} and member {@link SubCommand} instances to use when scanning.
 */
export function scanForNonModifierCommandClause(
  argSequences: ReadonlyArray<ReadonlyArray<string>>,
  nonModifierCommandsByName: ReadonlyMap<string, Command>,
  globalCommandsByShortAlias?: ReadonlyMap<string, Command>,
  groupAndMemberCommandsByJoinedName?: ReadonlyMap<
    string,
    { groupCommand: GroupCommand; command: SubCommand }
  >,
): ScanResult {
  logger.debug(() =>
    `Scanning args: '${
      JSON.stringify(argSequences)
    }' for non-modifier commands: '${
      Array.from(nonModifierCommandsByName.keys()).join(" ")
    }'`
  );

  const scanResult: ScanResult = {
    unusedArgSequences: [],
  };

  for (const argSequence of argSequences) {
    // if a command clause is already defined, we don't need to scan any further,
    // just add the unused args to the unused arg sequences
    if (scanResult.nonModifierCommandClause) {
      scanResult.unusedArgSequences.push(argSequence);
      continue;
    }

    const { commandClause, unusedArgs } = scanForNextCommandClause(
      argSequence,
      true,
      nonModifierCommandsByName,
      globalCommandsByShortAlias,
      groupAndMemberCommandsByJoinedName,
    );

    // args that weren't used in the current scan are given to the unused arg sequences
    if (unusedArgs.length > 0) {
      scanResult.unusedArgSequences.push(unusedArgs);
    }

    // use the result if we found a command
    if (commandClause) {
      scanResult.nonModifierCommandClause = commandClause;
    }
  }

  logger.debug("scan result: %O", scanResult);

  return scanResult;
}
