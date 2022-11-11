import Parser, {
  GlobalCommandClause,
  GlobalModifierCommandClause,
  InvalidArgument,
  ParseResult,
  ScanResult,
  SubCommandClause,
} from "../api/runtime/Parser.ts";
import CommandRegistry from "../api/registry/CommandRegistry.ts";
import GroupCommand from "../api/command/GroupCommand.ts";
import Command from "../api/command/Command.ts";
import GlobalModifierCommand from "../api/command/GlobalModifierCommand.ts";
import SubCommand from "../api/command/SubCommand.ts";
import GlobalCommand from "../api/command/GlobalCommand.ts";
import populateGlobalCommandValue from "./values/globalCommandValuePopulation.ts";
import {
  validateGlobalCommandArgumentValue,
  validateOptionValue,
  validatePositionalValue,
} from "./values/argumentValueValidation.ts";
import {
  ArgumentSingleValueType,
  ArgumentValues,
  ArgumentValueType,
} from "../api/argument/ArgumentValueTypes.ts";
import populateSubCommandValues from "./values/subCommandValuePopulation.ts";
import getLogger from "./util/logger.ts";

const logger = getLogger("DefaultParser");

/**
 * A container holding the result of a single scanning operation.
 */
export interface LocalScanResult {
  /**
   * The {@link Command} referenced as an argument if one was found.
   */
  readonly command?: Command;

  /**
   * `true` if {@link command} is populated and it is an instance of a {@link GlobalModifierCommand}.
   */
  readonly isGlobalModifierCommand: boolean;

  /**
   * `true` if {@link command} is populated and it is an instance of a {@link GlobalCommand}.
   */
  readonly isGlobalCommand: boolean;

  /**
   * Optional parent {@link GroupCommand} if {@link Command} is populated and is a member {@link SubCommand}.
   * NOTE: Cannot be true if either {@link isGlobalModifierCommand} or {@link isGlobalCommand} is true.
   */
  readonly groupCommand?: GroupCommand;

  /**
   * The potential arguments for the discovered {@link Command} ending before the next discovered {@link LocalScanResult}.
   */
  potentialArgs: Array<string>;

  /**
   * Any arguments which were unused in the scanning operation. As the scanning starts at the beginning of the
   * provided args looking for a {@link Command} name, this will effectively be any leading arguments before
   * the {@link Command} was found, or all args if no {@link Command} was found.
   */
  unusedLeadingArgs: Array<string>;
}

/**
 * Default implementation of a {@link Parser}.
 */
export default class DefaultParser implements Parser {
  private normaliseFirstArgumentIfRequired(
    args: Array<string>,
    commandRegistry: CommandRegistry,
    includeNonModifierCommands: boolean,
  ): Array<string> {
    const firstArg = args[0];

    // only looking for:
    // --<global_command_name>
    // --<global_modifier_command_name>
    // --<global_command_name>=<value>
    // --<global_modifier_command_name>=<value>
    // -<global_command_short_alias>
    // -<global_modifier_command_short_alias>
    // -<global_command_short_alias>=<value>
    // -<global_modifier_command_short_alias>=<value>
    if ((firstArg.length < 2) || (firstArg.charAt(0) !== "-")) {
      return args;
    }

    // looking for:
    // --<global_command_name>
    // --<global_modifier_command_name>
    // --<global_command_name>=<value>
    // --<global_modifier_command_name>=<value>
    if ((firstArg.length > 2) && (firstArg.charAt(1) === "-")) {
      let potentialGlobalCommandName = firstArg.slice(2);

      // looking for:
      // <global_command_name>=<value>
      // <global_modifier_command_name>=<value>
      let nextArg: string | undefined;
      if (potentialGlobalCommandName.includes("=")) {
        [potentialGlobalCommandName, nextArg] = potentialGlobalCommandName
          .split(/=(.*)/);
      }

      if (
        !commandRegistry.getGlobalModifierCommandByName(
          potentialGlobalCommandName,
        ) &&
        !(includeNonModifierCommands &&
          commandRegistry.getGlobalCommandByName(potentialGlobalCommandName))
      ) {
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
    // -<global_command_short_alias>
    // -<global_command_short_alias>=<value>
    // -<global_modifier_command_short_alias>
    // -<global_modifier_command_short_alias>=<value>
    // by now we know the arg starts with -<char>
    let potentialGlobalCommandShortAlias = firstArg.slice(1);

    // looking for:
    // <global_command_short_alias>=<value>
    // <global_modifier_command_short_alias>=<value>
    let nextArg: string | undefined;
    if (potentialGlobalCommandShortAlias.includes("=")) {
      [potentialGlobalCommandShortAlias, nextArg] =
        potentialGlobalCommandShortAlias.split(/=(.*)/);
    }

    // looking for <global_modifier_command_short_alias>
    const globalModifierCommand = commandRegistry
      .getGlobalModifierCommandByShortAlias(potentialGlobalCommandShortAlias);
    if (globalModifierCommand) {
      if (nextArg) {
        logger.debug(() =>
          `Normalised arg: '${firstArg}' to: '--${globalModifierCommand.name} ${nextArg}'`
        );
        return [`--${globalModifierCommand.name}`, nextArg, ...args.slice(1)];
      }
      logger.debug(() =>
        `Normalised arg: '${firstArg}' to: '--${globalModifierCommand.name}'`
      );
      return [`--${globalModifierCommand.name}`, ...args.slice(1)];
    }

    if (!includeNonModifierCommands) {
      // nothing changed
      return args;
    }

    // looking for <global_command_short_alias>
    const globalCommand = commandRegistry.getGlobalCommandByShortAlias(
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

  private scanForNextCommandArg(
    potentialArgs: ReadonlyArray<string>,
    includeNonModifierCommands: boolean,
    commandRegistry: CommandRegistry,
  ): LocalScanResult {
    logger.debug(() =>
      `Scanning args: '${potentialArgs.join(" ")}' for ${
        includeNonModifierCommands
          ? "all command types"
          : "global modifier commands only"
      }`
    );

    let pendingArgs = [...potentialArgs];
    const unusedLeadingArgs: string[] = [];

    while (pendingArgs.length > 0) {
      pendingArgs = this.normaliseFirstArgumentIfRequired(
        pendingArgs,
        commandRegistry,
        includeNonModifierCommands,
      );

      // take first argument
      const currentArg = pendingArgs[0];
      pendingArgs = pendingArgs.slice(1);

      // looking for:
      // <global_modifier_command_name>
      // <global_command_name>
      if (currentArg.startsWith("--")) {
        const potentialCommandName = currentArg.slice(2);

        // check for GlobalModifierCommand name
        const command = commandRegistry.getGlobalModifierCommandByName(
          potentialCommandName,
        );
        if (command) {
          logger.debug(() =>
            `Found global modifier command name: '${potentialCommandName}'`
          );
          return {
            command,
            isGlobalCommand: true,
            isGlobalModifierCommand: true,
            potentialArgs: pendingArgs,
            unusedLeadingArgs,
          };
        }

        // only check for GlobalCommand names if we were told to
        if (includeNonModifierCommands) {
          const command = commandRegistry.getGlobalCommandByName(
            potentialCommandName,
          );
          if (command) {
            logger.debug(() =>
              `Found global command name: '${potentialCommandName}'`
            );
            return {
              command,
              isGlobalCommand: true,
              isGlobalModifierCommand: false,
              potentialArgs: pendingArgs,
              unusedLeadingArgs,
            };
          }
        }
      }
      // looking for:
      // <group_command_name>:<member_sub_command_name>
      // <group_command_name> <member_sub_command_name>
      // <sub_command_name>
      // but we should only check for such non-modifier command names if were told to
      if ((currentArg[0] !== "-") && includeNonModifierCommands) {
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
          const found = commandRegistry
            .getGroupCommandAndMemberSubCommandByNames(
              potentialGroupCommandName,
              potentialMemberSubCommandName,
            );
          if (found) {
            const { groupCommand, memberSubCommand } = found;
            if (groupCommand) {
              logger.debug(() =>
                `Found group command name: '${potentialGroupCommandName}' and member sub-command name: '${potentialMemberSubCommandName}'`
              );

              return {
                command: memberSubCommand,
                isGlobalCommand: false,
                isGlobalModifierCommand: false,
                groupCommand,
                potentialArgs: pendingArgs,
                unusedLeadingArgs,
              };
            }
          }
        }
        // if group parsing was not needed, revert state if necessary
        if (
          potentialMemberCommandNameArgumentUsed &&
          (potentialMemberSubCommandName !== undefined)
        ) {
          pendingArgs.unshift(potentialMemberSubCommandName!);
        }

        // looking for:
        // <sub_command_name>
        const command = commandRegistry.getSubCommandByName(currentArg);
        if (command) {
          logger.debug(() => `Found sub-command name: '${currentArg}'`);

          return {
            command,
            isGlobalCommand: false,
            isGlobalModifierCommand: false,
            potentialArgs: pendingArgs,
            unusedLeadingArgs,
          };
        }
      }
      // if we got here we haven't found a command but we have further provided args to process
      // so add the current arg to leading unused args
      unusedLeadingArgs.push(currentArg);
    }
    // if we got here we haven't found a command and we have processed all provided args
    return {
      isGlobalCommand: false,
      isGlobalModifierCommand: false,
      potentialArgs: [],
      unusedLeadingArgs,
    };
  }

  public scanForCommandClauses(
    args: ReadonlyArray<string>,
    commandRegistry: CommandRegistry,
  ): ScanResult {
    const localScanResults: Array<LocalScanResult> = [];
    const unusedLeadingArgs: Array<string> = [];
    let lastLocalScanResult: LocalScanResult | undefined;
    let currentLocalScanResult: LocalScanResult;

    // if we already found a non-modifier command, we should no longer search for these as we only
    // support specifying a single non-modifier command in the args, so we should assume further args
    // are not non-modifier command names
    let includeNonModifierCommands = true;

    // while we still have args to scan for clauses
    while (args.length > 0) {
      // scan for next command
      currentLocalScanResult = this.scanForNextCommandArg(
        args,
        includeNonModifierCommands,
        commandRegistry,
      );

      // args that weren't used in the current scan are...
      if (lastLocalScanResult) {
        // ... allocated back to the previous scan result or...
        lastLocalScanResult.potentialArgs =
          currentLocalScanResult.unusedLeadingArgs;
        currentLocalScanResult.unusedLeadingArgs = [];
      } else {
        // ...to the unused args in no previous scan result
        unusedLeadingArgs.push(...currentLocalScanResult.unusedLeadingArgs);
        currentLocalScanResult.unusedLeadingArgs = [];
      }

      // save the result if we found a command
      if (currentLocalScanResult.command) {
        localScanResults.push(currentLocalScanResult);

        // register if we found a non-modifier command
        if (!currentLocalScanResult.isGlobalModifierCommand) {
          includeNonModifierCommands = false;
        }

        // now set the current scan result as the last scan result
        lastLocalScanResult = currentLocalScanResult;
      } else {
        // clear the last scan result if we didn't find a command
        lastLocalScanResult = undefined;
      }

      // take all of the potential args from the current scan result and use them for a potential new scan result
      args = currentLocalScanResult.potentialArgs;
    }

    let subCommandClause: SubCommandClause | undefined;
    let globalCommandClause: GlobalCommandClause | undefined;
    const globalModifierCommandClauses: Array<GlobalModifierCommandClause> = [];

    // process the local results to return a scan result
    localScanResults.forEach((localScanResult) => {
      if (localScanResult.isGlobalModifierCommand) {
        globalModifierCommandClauses.push({
          command: localScanResult.command as GlobalModifierCommand,
          potentialArgs: localScanResult.potentialArgs,
        });
      } else if (localScanResult.isGlobalCommand) {
        globalCommandClause = {
          command: localScanResult.command as GlobalCommand,
          potentialArgs: localScanResult.potentialArgs,
        };
      } else {
        if (localScanResult.groupCommand) {
          subCommandClause = {
            command: localScanResult.command as SubCommand,
            groupCommand: localScanResult.groupCommand,
            potentialArgs: localScanResult.potentialArgs,
          };
        } else {
          subCommandClause = {
            command: localScanResult.command as SubCommand,
            potentialArgs: localScanResult.potentialArgs,
          };
        }
      }
    });

    let scanResult: ScanResult;
    if (subCommandClause) {
      scanResult = {
        subCommandClause,
        globalModifierCommandClauses,
        unusedLeadingArgs,
      };
    } else if (globalCommandClause) {
      scanResult = {
        globalCommandClause,
        globalModifierCommandClauses,
        unusedLeadingArgs,
      };
    } else {
      scanResult = {
        globalModifierCommandClauses,
        unusedLeadingArgs,
      };
    }

    logger.debug(() => {
      const messages: Array<string> = [];
      if (scanResult.subCommandClause) {
        let subCommandClauseMessage =
          `{command: '${scanResult.subCommandClause.command.name}', args: ${
            JSON.stringify(scanResult.subCommandClause.potentialArgs)
          }}`;
        if (scanResult.subCommandClause.groupCommand) {
          subCommandClauseMessage =
            `{groupCommand: {command: '${scanResult.subCommandClause.groupCommand.name}', ${subCommandClauseMessage}}}`;
        }
        messages.push(`sub-command clause: ${subCommandClauseMessage}`);
      }
      if (scanResult.globalCommandClause) {
        const globalClauseMessage =
          `global clause: {command: '${scanResult.globalCommandClause.command.name}', args: ${
            JSON.stringify(scanResult.globalCommandClause.potentialArgs)
          }}`;
        messages.push(globalClauseMessage);
      }
      let globalModifierClausesMessage = scanResult
        .globalModifierCommandClauses.map(
          (clause) => {
            return `command: '${clause.command.name}', args: ${
              JSON.stringify(clause.potentialArgs)
            }`;
          },
        ).join(", ");
      globalModifierClausesMessage =
        `global modifier clauses: [${globalModifierClausesMessage}]`;
      messages.push(globalModifierClausesMessage);
      const unusedLeadingArgsMessage = `unused args: ${
        JSON.stringify(scanResult.unusedLeadingArgs)
      }`;
      messages.push(unusedLeadingArgsMessage);
      return `scanResult: ${messages.join(", ")}`;
    });

    return scanResult;
  }

  public parseSubCommandClause(
    subCommandClause: SubCommandClause,
    configuredValues?: ArgumentValues,
  ): ParseResult {
    const { command, groupCommand, potentialArgs } = subCommandClause;
    const invalidArguments: Array<InvalidArgument> = [];

    // check if we need to process any arguments at all
    if ((command.options.length === 0) && (command.positionals.length === 0)) {
      return {
        command,
        groupCommand,
        argumentValues: {},
        invalidArguments,
        unusedTrailingArgs: potentialArgs,
      };
    }

    const { populatedArgumentValues, unusedTrailingArgs, invalidArgument } =
      populateSubCommandValues(
        command,
        potentialArgs,
        configuredValues,
      );

    if (invalidArgument) {
      invalidArguments.push(invalidArgument);
    }

    // validate the option values
    command.options.forEach((option) => {
      const validatedValue = validateOptionValue(
        option,
        populatedArgumentValues[option.name] || option.defaultValue,
        invalidArguments,
      );
      if (validatedValue !== undefined) {
        populatedArgumentValues[option.name] = validatedValue;
      }
    });

    logger.debug(() =>
      `Command arguments after options validated: ${
        JSON.stringify(populatedArgumentValues)
      } with invalid args: ${JSON.stringify(invalidArguments)}`
    );

    // validate the positional values
    command.positionals.forEach((positional) => {
      const validatedValue = validatePositionalValue(
        positional,
        populatedArgumentValues[positional.name] as ArgumentValueType,
        invalidArguments,
      );
      if (validatedValue !== undefined) {
        populatedArgumentValues[positional.name] = validatedValue;
      }
    });

    logger.debug(() =>
      `Command arguments after positionals validated: ${
        JSON.stringify(populatedArgumentValues)
      } with invalid args: ${JSON.stringify(invalidArguments)}`
    );

    if (groupCommand) {
      return {
        command,
        argumentValues: populatedArgumentValues as ArgumentValues,
        groupCommand,
        invalidArguments,
        unusedTrailingArgs,
      };
    }
    return {
      command,
      argumentValues: populatedArgumentValues as ArgumentValues,
      invalidArguments,
      unusedTrailingArgs,
    };
  }

  public parseGlobalCommandClause(
    globalCommandClause: GlobalCommandClause | GlobalModifierCommandClause,
    configuredValue?: ArgumentSingleValueType,
  ): ParseResult {
    const { command, potentialArgs } = globalCommandClause;
    const argumentValues: ArgumentValues = {};
    const invalidArguments: Array<InvalidArgument> = [];

    // check if we need to process an argument at all
    if (!command.argument) {
      return {
        command,
        argumentValues,
        invalidArguments,
        unusedTrailingArgs: potentialArgs,
      };
    }

    const { populatedArgumentValue, unusedTrailingArgs, invalidArgument } =
      populateGlobalCommandValue(
        command,
        potentialArgs,
        configuredValue,
      );

    if (invalidArgument) {
      invalidArguments.push(invalidArgument);
    }

    // check if argument is already invalid
    if (invalidArguments.length === 0) {
      // validate the value
      const validatedValue = validateGlobalCommandArgumentValue(
        command.argument,
        populatedArgumentValue,
        invalidArguments,
      );
      if (validatedValue !== undefined) {
        argumentValues[command.name] = validatedValue;
      }
    }

    logger.debug(() =>
      `Command arguments for command ${command.name} after value validated: ${
        JSON.stringify(argumentValues)
      } with invalid args: ${JSON.stringify(invalidArguments)}`
    );

    return {
      command,
      argumentValues,
      invalidArguments,
      unusedTrailingArgs,
    };
  }
}
