import type Context from "../api/Context.ts";
import type RunResult from "../api/RunResult.ts";
import { RunState } from "../api/RunResult.ts";
import type CommandRegistry from "./registry/CommandRegistry.ts";
import { isGlobalCommand, isSubCommand } from "./command/CommandTypeGuards.ts";
import type {
  ArgumentSingleValueType,
  ArgumentValues,
  PopulatedArgumentSingleValueType,
  PopulatedArgumentValues,
} from "../api/argument/ArgumentValueTypes.ts";
import getLogger from "../util/logger.ts";
import {
  printCommandExecutionError,
  printNoCommandSpecifiedError,
  printParseResultError,
  printUnusedArgsWarning,
} from "../util/runnerHelper.ts";
import {
  scanForGlobalModifierCommandClauses,
  scanForNonModifierCommandClause,
} from "./scanner.ts";
import type ServiceProviderRegistry from "./registry/ServiceProviderRegistry.ts";
import {
  parseGlobalCommandClause,
  type ParseResult,
  parseSubCommandClause,
} from "./parser.ts";
import type ConfigurationServiceProvider from "../service/configuration/ConfigurationServiceProvider.ts";
import type GlobalModifierCommand from "../api/command/GlobalModifierCommand.ts";
import type GroupCommand from "../api/command/GroupCommand.ts";
import type SubCommand from "../api/command/SubCommand.ts";
import type GlobalCommand from "../api/command/GlobalCommand.ts";
import type Command from "../api/command/Command.ts";

const logger = getLogger("runner");

/**
 * Execute the {@link Command} with arguments contained in the provided {@link ParseResult}.
 *
 * @param parseResult the {@link ParseResult} to execute.
 * @param context the {@link Context} to use.
 * @param configurationServiceProvider optional {@link ConfigurationServiceProvider} to use to get default argument values.
 * @param isDefaultCommand whether the command is the default command for the CLI.
 */
async function executeParsedCommand(
  parseResult: ParseResult,
  context: Context,
  configurationServiceProvider: ConfigurationServiceProvider | undefined,
  isDefaultCommand = false,
): Promise<RunResult> {
  try {
    if (parseResult.groupCommand !== undefined) {
      logger.debug(
        "Executing group command with name: %s",
        parseResult!.groupCommand!.name,
      );
      if (configurationServiceProvider?.keyValueServiceEnabled) {
        configurationServiceProvider.setCommandKeyValueScope(
          parseResult!.groupCommand!.name,
        );
      }
      await parseResult.groupCommand.execute(context);
      if (configurationServiceProvider?.keyValueServiceEnabled) {
        await configurationServiceProvider.clearKeyValueScope();
      }
    }

    logger.debug(
      "Executing command with name: %s and args: %j",
      parseResult!.command.name,
      parseResult!.populatedArgumentValues,
    );

    if (configurationServiceProvider?.keyValueServiceEnabled) {
      configurationServiceProvider.setCommandKeyValueScope(
        parseResult.command.name,
      );
    }
    if (isSubCommand(parseResult.command)) {
      await parseResult.command.execute(
        context,
        parseResult.populatedArgumentValues as ArgumentValues,
      );
    } else {
      await (parseResult.command as GlobalCommand).execute(
        context,
        parseResult.populatedArgumentValues as ArgumentSingleValueType,
      );
    }
    if (configurationServiceProvider?.keyValueServiceEnabled) {
      await configurationServiceProvider.clearKeyValueScope();
    }
  } catch (err) {
    await printCommandExecutionError(
      context,
      parseResult,
      err as Error,
      isDefaultCommand,
    );
    return {
      runState: RunState.EXECUTION_ERROR,
      command: parseResult.command,
      error: err as Error,
    };
  }

  return {
    runState: RunState.SUCCESS,
  };
}

/**
 * Parse arguments and execute any of the specified {@link GlobalModifierCommand} instances with specified argument values.
 *
 * @param availableArgSequences the list of argument sequences to process.
 * @param unusedArgSequences an array to which any unused argument sequences will be added.
 * @param globalModifierCommandsByName a map of non-modifier {@link Command} instances by name to parse for.
 * @param globalModifierCommandsByShortAlias a map of {@link GlobalModifierCommand} instances by short alias to use when scanning.
 * @param configurationServiceProvider optional {@link ConfigurationServiceProvider} to use to get default argument values.
 * @param context the {@link Context} to use.
 */
async function findAndExecuteGlobalModifierCommands(
  availableArgSequences: ReadonlyArray<ReadonlyArray<string>>,
  unusedArgSequences: Array<ReadonlyArray<string>>,
  globalModifierCommandsByName: ReadonlyMap<string, GlobalModifierCommand>,
  globalModifierCommandsByShortAlias: ReadonlyMap<
    string,
    GlobalModifierCommand
  >,
  configurationServiceProvider: ConfigurationServiceProvider | undefined,
  context: Context,
): Promise<RunResult | undefined> {
  // build a list of GlobalModifierCommands to execute
  const globalModifierCommandParseResults: Array<ParseResult> = [];

  // maintain a list of remaining GlobalModifierCommands to scan
  let remainingGlobalModifierCommands = Array.from(
    globalModifierCommandsByName.values(),
  );
  const scanResult = scanForGlobalModifierCommandClauses(
    availableArgSequences,
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );

  // add any unused args back to the list of still available args for next scan operation
  unusedArgSequences.push(...scanResult.unusedArgSequences);

  if (scanResult.globalModifierCommandClauses) {
    for (
      const globalModifierCommandClause of scanResult
        .globalModifierCommandClauses
    ) {
      // parse and fast fail on error
      const defaultArgumentValues = configurationServiceProvider
        ? configurationServiceProvider
          .getDefaultArgumentValues(
            context.cliConfig,
            globalModifierCommandClause.command,
          )
        : undefined;
      const parseResult = parseGlobalCommandClause(
        globalModifierCommandClause,
        defaultArgumentValues as PopulatedArgumentSingleValueType,
      );

      if (parseResult.invalidArguments.length > 0) {
        await printParseResultError(context, parseResult);
        return {
          runState: RunState.PARSE_ERROR,
          command: parseResult.command,
          invalidArguments: parseResult.invalidArguments,
        };
      }

      // add any unused args back to the list of still available args for next scan operation
      if (parseResult.unusedArgs.length > 0) {
        unusedArgSequences.push(parseResult.unusedArgs);
      }

      // add the clause to the list of clauses to execute
      globalModifierCommandParseResults.push(parseResult);

      // remove current GlobalModifierCommand from the list which we will later continue to
      // scan for as a default command in the ConfigurationServiceProvider
      remainingGlobalModifierCommands = remainingGlobalModifierCommands.filter((
        command,
      ) => command.name !== globalModifierCommandClause.command.name);
    }
  }

  // scan for remaining GlobalModifierCommand with default argument values in the ConfigurationServiceProvider
  for (const globalModifierCommand of remainingGlobalModifierCommands) {
    // if there is a config entry run this by default even though no arguments were provided on the command line
    const defaultArgumentValues = configurationServiceProvider
      ? configurationServiceProvider
        .getDefaultArgumentValues(context.cliConfig, globalModifierCommand)
      : undefined;

    if (defaultArgumentValues !== undefined) {
      // parse and fast fail on error
      const parseResult = parseGlobalCommandClause({
        command: globalModifierCommand,
        potentialArgs: [],
      }, defaultArgumentValues as PopulatedArgumentSingleValueType);

      if (parseResult.invalidArguments.length > 0) {
        await printParseResultError(context, parseResult);
        return {
          runState: RunState.PARSE_ERROR,
          command: parseResult.command,
          invalidArguments: parseResult.invalidArguments,
        };
      }

      // add the clause to the list of clauses to execute
      globalModifierCommandParseResults.push(parseResult);
    }
  }

  // execute GlobalModifierCommand clauses in executePriority order
  globalModifierCommandParseResults.sort((a, b) =>
    (b.command as GlobalModifierCommand).executePriority -
    (a.command as GlobalModifierCommand).executePriority
  );
  for (const parseResult of globalModifierCommandParseResults) {
    // execute and fast fail on error
    const runResult = await executeParsedCommand(
      parseResult,
      context,
      configurationServiceProvider,
    );
    if (runResult.runState !== RunState.SUCCESS) {
      return runResult;
    }
  }
}

/**
 * Parse arguments and execute at most one of the specified non-modifier {@link Command} instances with specified argument values.
 *
 * @param availableArgs the list of argument sequences to process.
 * @param unusedArgs an array to which any unused argument sequences will be added.
 * @param nonModifierCommandsByName the map of non-modifier {@link Command} instances by name to parse for.
 * @param globalCommandsByShortAlias the map of {@link GlobalCommand} instances by short alias to use when scanning.
 * @param groupAndMemberCommandsByJoinedName optional map of {@link GroupCommand} and member {@link SubCommand} instances to use when scanning.
 * @param configurationServiceProvider optional {@link ConfigurationServiceProvider} to use to get default argument values.
 * @param context the {@link Context} to use.
 */
async function findAndExecuteNonModifierCommand(
  availableArgs: ReadonlyArray<ReadonlyArray<string>>,
  unusedArgs: Array<ReadonlyArray<string>>,
  nonModifierCommandsByName: ReadonlyMap<string, Command>,
  globalCommandsByShortAlias: ReadonlyMap<string, GlobalCommand>,
  groupAndMemberCommandsByJoinedName:
    | ReadonlyMap<string, { groupCommand: GroupCommand; command: SubCommand }>
    | undefined,
  configurationServiceProvider: ConfigurationServiceProvider | undefined,
  context: Context,
): Promise<RunResult | undefined> {
  let parseResult: ParseResult | undefined;

  const scanResult = scanForNonModifierCommandClause(
    availableArgs,
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
    groupAndMemberCommandsByJoinedName,
  );

  // add any unused args back to the list of still available args for next scan operation
  unusedArgs.push(...scanResult.unusedArgSequences);

  if (scanResult.nonModifierCommandClause) {
    const defaultArgumentValues = configurationServiceProvider
      ? configurationServiceProvider
        .getDefaultArgumentValues(
          context.cliConfig,
          scanResult.nonModifierCommandClause.command,
        )
      : undefined;

    if (isGlobalCommand(scanResult.nonModifierCommandClause.command)) {
      parseResult = parseGlobalCommandClause(
        scanResult.nonModifierCommandClause,
        defaultArgumentValues as PopulatedArgumentSingleValueType,
      );
    } else {
      parseResult = parseSubCommandClause(
        scanResult.nonModifierCommandClause,
        defaultArgumentValues as PopulatedArgumentValues,
      );
    }

    if (parseResult.invalidArguments.length > 0) {
      await printParseResultError(context, parseResult);
      return {
        runState: RunState.PARSE_ERROR,
        command: parseResult.command,
        invalidArguments: parseResult.invalidArguments,
      };
    }

    // add any unused args back to the list of still unused args
    if (parseResult.unusedArgs.length > 0) {
      unusedArgs.push(parseResult.unusedArgs);
    }
  } else {
    // scan for a non-modifier Command with default argument values in the ConfigurationServiceProvider
    for (const nonModifierCommand of nonModifierCommandsByName.values()) {
      // if there is a config entry run this by default even though no arguments were provided on the command line
      const defaultArgumentValues = configurationServiceProvider
        ? configurationServiceProvider
          .getDefaultArgumentValues(context.cliConfig, nonModifierCommand)
        : undefined;

      if (defaultArgumentValues !== undefined) {
        if (isGlobalCommand(nonModifierCommand)) {
          parseResult = parseGlobalCommandClause({
            command: nonModifierCommand,
            potentialArgs: [],
          }, defaultArgumentValues as PopulatedArgumentSingleValueType);
        } else {
          parseResult = parseSubCommandClause({
            command: nonModifierCommand,
            potentialArgs: [],
          }, defaultArgumentValues as PopulatedArgumentValues);
        }

        if (parseResult.invalidArguments.length > 0) {
          await printParseResultError(context, parseResult);
          return {
            runState: RunState.PARSE_ERROR,
            command: parseResult.command,
            invalidArguments: parseResult.invalidArguments,
          };
        }

        break;
      }
    }
  }

  // give up if still nothing found
  if (parseResult === undefined) {
    return;
  }

  // warn on unused args
  if (unusedArgs.length > 0) {
    await printUnusedArgsWarning(context, unusedArgs.flat());
  }

  return executeParsedCommand(
    parseResult,
    context,
    configurationServiceProvider,
  );
}

/**
 * Assume provided command in use and parse arguments and execute with specified argument values if valid.
 *
 * @param availableArgs the list of argument sequences to process.
 * @param unusedArgs an array to which any unused argument sequences will be added.
 * @param defaultNonModifierCommand the default non-modifier {@link Command} to use.
 * @param configurationServiceProvider optional {@link ConfigurationServiceProvider} to use to get default argument values.
 * @param context the {@link Context} to use.
 */
async function findAndExecuteDefaultNonModifierCommand(
  availableArgs: ReadonlyArray<ReadonlyArray<string>>,
  unusedArgs: Array<ReadonlyArray<string>>,
  defaultNonModifierCommand: Command,
  configurationServiceProvider: ConfigurationServiceProvider | undefined,
  context: Context,
): Promise<RunResult | undefined> {
  const defaultArgumentValues = configurationServiceProvider
    ? configurationServiceProvider
      .getDefaultArgumentValues(context.cliConfig, defaultNonModifierCommand)
    : undefined;
  const isGlobal = isGlobalCommand(defaultNonModifierCommand);
  let parseResult: ParseResult | undefined;

  // save invalid args to report them if no valid command is found
  let lastErroneousParseResult;

  // create a dummy clause using the default command for each arg sequence
  for (const argSequence of availableArgs) {
    // if already successfully parsed a clause, cycle through remaining arg sequences to add them to unusedArgs
    if (parseResult) {
      unusedArgs.push(argSequence);
      continue;
    }
    if (isGlobal) {
      parseResult = parseGlobalCommandClause({
        command: defaultNonModifierCommand,
        potentialArgs: [...argSequence],
      }, defaultArgumentValues as PopulatedArgumentSingleValueType);
    } else {
      parseResult = parseSubCommandClause({
        command: defaultNonModifierCommand,
        potentialArgs: [...argSequence],
      }, defaultArgumentValues as PopulatedArgumentValues);
    }

    // add any unused args back to the list of still unused args
    if (parseResult.unusedArgs.length > 0) {
      unusedArgs.push(parseResult.unusedArgs);
    }

    if (parseResult.invalidArguments.length > 0) {
      lastErroneousParseResult = parseResult;
      parseResult = undefined;
    }
  }

  // even though no arguments were provided on the command line, run the command by default
  // if there are no arguments for the command or there is a config entry
  let commandHasNoArgs;
  if (isGlobal) {
    commandHasNoArgs =
      (defaultNonModifierCommand as GlobalCommand).argument === undefined;
  } else {
    commandHasNoArgs =
      ((defaultNonModifierCommand as SubCommand).options.length === 0) &&
      ((defaultNonModifierCommand as SubCommand).positionals.length === 0);
  }
  if (
    (parseResult === undefined) &&
    (commandHasNoArgs || (defaultArgumentValues !== undefined))
  ) {
    if (isGlobal) {
      parseResult = parseGlobalCommandClause({
        command: defaultNonModifierCommand,
        potentialArgs: [],
      }, defaultArgumentValues as PopulatedArgumentSingleValueType);
    } else {
      parseResult = parseSubCommandClause({
        command: defaultNonModifierCommand,
        potentialArgs: [],
      }, defaultArgumentValues as PopulatedArgumentValues);
    }

    if (parseResult.invalidArguments.length > 0) {
      lastErroneousParseResult = parseResult;
      parseResult = undefined;
    }
  }

  // if there were invalid arguments, treat this as the error
  if (lastErroneousParseResult) {
    await printParseResultError(context, lastErroneousParseResult, true);
    return {
      runState: RunState.PARSE_ERROR,
      command: defaultNonModifierCommand,
      invalidArguments: lastErroneousParseResult.invalidArguments,
    };
  }

  // give up if still nothing found
  if (parseResult === undefined) {
    return;
  }

  // warn on unused args
  if (unusedArgs.length > 0) {
    await printUnusedArgsWarning(context, unusedArgs.flat());
  }

  return executeParsedCommand(
    parseResult,
    context,
    configurationServiceProvider,
    true,
  );
}

/**
 * Scan arguments and execute the parsed {@link Command} clauses with provided argument values
 * using the provided {@link Context}.
 *
 * An overview of the logic (assuming the optional ConfigurationServiceProvider is provided):
 *
 * 1. For each ServiceProvider in servicePriority order:
 *    - Scan arguments for GlobalModifierCommand clauses provided by the ServiceProvider
 *    - For each discovered clause:
 *      - Set any argument defaults from ConfigurationServiceProvider
 *      - Parse the arguments for the GlobalModifierCommand
 *      - Return on error
 *      - Add to list of GlobalModifierCommands to execute
 *    - Scan ConfigurationServiceProvider for GlobalModifierCommand clauses provided by the ServiceProvider not already found in arguments
 *    - For each configured clause:
 *      - Parse the arguments for the GlobalModifierCommand
 *      - Return on error
 *      - Add to list of GlobalModifierCommands to execute
 *    - Order the GlobalModifierCommand clauses in executePriority order
 *    - For each GlobalModifierCommand clause:
 *      - Execute the GlobalModifierCommand
 *      - Return on error
 *    - Init the ServiceProvider's service.
 * 2. Scan arguments for any GlobalModifierCommand clauses not provided by ServiceProviders
 *    - For each discovered clause:
 *      - Set any argument defaults from ConfigurationServiceProvider
 *      - Parse the arguments for the GlobalModifierCommand
 *      - Return on error
 *      - Add to list of GlobalModifierCommands to execute
 * 3. Scan ConfigurationServiceProvider for GlobalModifierCommand clauses not provided by the ServiceProvider and not already found in arguments
 *    - For each discovered clause:
 *    - Parse the arguments for the GlobalModifierCommand
 *    - Return on error
 *    - Add to list of GlobalModifierCommands to execute
 * 4. Order the GlobalModifierCommand clauses in executePriority order
 * 5. For each GlobalModifierCommand clause:
 *    - Execute the GlobalModifierCommand
 *    - Return on error
 * 6. Scan for a single non-modifier Command clause:
 *    - If found:
 *      - Set any argument defaults from ConfigurationServiceProvider
 *      - Parse the arguments for the non-modifier Command
 *      - Return on error
 *      - Warn on any unused arguments
 *      - Execute the non-modifier Command
 *      - Return on success or error
 * 7. If default non-modifier Command provided:
 *    - Scan for default non-modifier Command clause
 *    - If found:
 *      - Set any argument defaults from ConfigurationServiceProvider
 *      - Parse the arguments for the non-modifier Command (but do not fail)
 *      - If parsing succeeds:
 *        - Warn on any unused arguments
 *        - Execute the non-modifier Command
 *        - Return on success or error
 *    - If not found:
 *      - Set any argument defaults from ConfigurationServiceProvider
 *      - Parse the arguments for the non-modifier Command (do not fail if required arguments are missing)
 *      - Execute the resulting non-modifier Command (fail on error)
 *
 * @param args the command line arguments (which do not include the invoked executable name).
 * @param commandRegistry the {@link CommandRegistry} to use when scanning and parsing.
 * @param serviceProviderRegistry the {@link ServiceProviderRegistry} to use when scanning and parsing.
 * @param configurationServiceProvider optional {@link ConfigurationServiceProvider} to use for accessing argument defaults.
 * @param context the {@link Context} in which to execute specified {@link Command} instances.
 * @param defaultCommand optional {@link SubCommand} or {@link GlobalCommand} implementation to attempt to parse arguments for and execute if
 * no non-modifier {@link Command} name is identified in the provided arguments.
 */
export async function run(
  args: ReadonlyArray<string>,
  commandRegistry: CommandRegistry,
  serviceProviderRegistry: ServiceProviderRegistry,
  configurationServiceProvider: ConfigurationServiceProvider | undefined,
  context: Context,
  defaultCommand?: Command,
): Promise<RunResult> {
  if (
    defaultCommand && !isSubCommand(defaultCommand) &&
    !isGlobalCommand(defaultCommand)
  ) {
    throw new Error(
      "If a default command is provided, if must be a global command or sub-command!",
    );
  }
  // maintain a list of args still available for parsing
  // the is an array because the provided args will be segmented into sequences by identified command clauses
  // this is to prevent incorrectly parsing arguments as if they were interleaved across multiple commands which is not supported
  let availableArgs: ReadonlyArray<ReadonlyArray<string>> = [args];
  let unusedArgs: Array<ReadonlyArray<string>> = [];

  // for each ServiceProvider (they are returned in servicePriority order)
  for (const serviceProvider of serviceProviderRegistry.getServiceProviders()) {
    // using the GlobalModifierCommands instances provided by the ServiceProvider...
    const globalModifierCommandsByName = commandRegistry
      .getGlobalModifierCommandsByNameProvidedByService(
        serviceProvider.serviceId,
      );
    const globalModifierCommandsByShortAlias = commandRegistry
      .getGlobalModifierCommandsByShortAliasProvidedByService(
        serviceProvider.serviceId,
      );

    // if there are GlobalModifierCommands provided by the ServiceProvider...
    if (globalModifierCommandsByName.size > 0) {
      // ...scan arguments, parse any resulting clauses and execute any resulting parsed GlobalModifierCommands
      const runResult = await findAndExecuteGlobalModifierCommands(
        availableArgs,
        unusedArgs,
        globalModifierCommandsByName,
        globalModifierCommandsByShortAlias,
        configurationServiceProvider,
        context,
      );

      // nothing is returned unless a command was found and there was an error, in which case return the error
      if (runResult) {
        return runResult;
      }

      // update args for the next scan operation
      availableArgs = unusedArgs;
      unusedArgs = [];
    }

    // init the service provider's service

    logger.debug("Initialising service with ID: %s", serviceProvider.serviceId);

    if (configurationServiceProvider?.keyValueServiceEnabled) {
      configurationServiceProvider.setServiceKeyValueScope(
        serviceProvider.serviceId,
      );
    }

    await serviceProvider.initService(context);
    if (configurationServiceProvider?.keyValueServiceEnabled) {
      await configurationServiceProvider.clearKeyValueScope();
    }
  }

  // using the GlobalModifierCommands instances which are NOT provided by a ServiceProvider...
  const globalModifierCommandsByName = commandRegistry
    .getGlobalModifierCommandsByNameNotProvidedByService();
  const globalModifierCommandsByShortAlias = commandRegistry
    .getGlobalModifierCommandsByShortAliasNotProvidedByService();

  // if there are GlobalModifierCommands NOT provided by the ServiceProvider...
  if (globalModifierCommandsByName.size > 0) {
    // ...scan arguments, parse any resulting clauses and execute any resulting parsed GlobalModifierCommands
    const runResult = await findAndExecuteGlobalModifierCommands(
      availableArgs,
      unusedArgs,
      globalModifierCommandsByName,
      globalModifierCommandsByShortAlias,
      configurationServiceProvider,
      context,
    );

    // nothing is returned unless a command was found and there was an error, in which case return the error
    if (runResult) {
      return runResult;
    }

    // update args for the next scan operation
    availableArgs = unusedArgs;
    unusedArgs = [];
  }

  // using the non-modifier Command instances...
  const nonModifierCommandsByName = commandRegistry
    .getNonModifierCommandsByName();
  const globalCommandsByShortAlias = commandRegistry
    .getGlobalCommandsByShortAlias();
  // and any group/member instance combinations...
  const groupAndMemberCommandByJoinedName = commandRegistry
    .getGroupAndMemberCommandsByJoinedName();

  // ...scan arguments, parse a resulting clause and execute a resulting parsed non-modifier Command
  let runResult = await findAndExecuteNonModifierCommand(
    availableArgs,
    unusedArgs,
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
    groupAndMemberCommandByJoinedName,
    configurationServiceProvider,
    context,
  );

  // nothing is returned if no command was discovered (otherwise a run result is returned)
  if (runResult) {
    return runResult;
  }

  // update args for the next scan operation
  availableArgs = unusedArgs;
  unusedArgs = [];

  // if default non-modifier Command provided...
  if (defaultCommand) {
    // ...assume default command name and parse resulting clauses and execute a resulting parsed non-modifier Command if found
    runResult = await findAndExecuteDefaultNonModifierCommand(
      availableArgs,
      unusedArgs,
      defaultCommand,
      configurationServiceProvider,
      context,
    );

    // nothing is returned if no command was discovered (otherwise a run result is returned)
    if (runResult) {
      return runResult;
    }
  }

  // give up if we haven't successfully parsed a non-modifier Command by now
  await printNoCommandSpecifiedError(context);
  return {
    runState: RunState.NO_COMMAND,
  };
}
