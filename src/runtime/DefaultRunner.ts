import Runner from "./Runner.ts";
import Context from "../api/Context.ts";
import Parser, {
  GlobalCommandClause,
  GlobalModifierCommandClause,
  ParseResult,
  SubCommandClause,
} from "./Parser.ts";
import RunResult, { RunState } from "../api/RunResult.ts";
import Printer, {
  Icon,
  PRINTER_SERVICE_ID,
} from "../api/service/core/Printer.ts";
import CommandRegistry from "./registry/CommandRegistry.ts";
import { NonModifierCommand } from "../api/command/NonModifierCommand.ts";
import {
  isGlobalCommand,
  isGlobalModifierCommand,
} from "../api/command/CommandTypeGuards.ts";
import SubCommand from "../api/command/SubCommand.ts";
import {
  ArgumentSingleValueType,
  ArgumentValues,
} from "../api/argument/ArgumentValueTypes.ts";
import getLogger from "../util/logger.ts";
import { getInvalidArgumentString } from "./values/argumentValueValidation.ts";
import GlobalModifierCommand from "../api/command/GlobalModifierCommand.ts";

const logger = getLogger("DefaultRunner");

function getCommandString(printer: Printer, parseResult: ParseResult): string {
  const { command, groupCommand } = parseResult;

  let commandString;
  if (isGlobalCommand(command)) {
    commandString = "global command ";
  } else if (isGlobalModifierCommand(command)) {
    commandString = "global modifier command ";
  } else {
    commandString = "command ";
  }
  if (groupCommand) {
    return printer.yellow(
      `${commandString}'${groupCommand.name}:${command.name}'`,
    );
  }
  return printer.yellow(`${commandString}'${command.name}'`);
}

async function printParseResultError(
  context: Context,
  parseResult: ParseResult,
) {
  const printer = context.getServiceById(PRINTER_SERVICE_ID) as Printer;
  const commandString = getCommandString(printer, parseResult);
  const { command, invalidArguments } = parseResult;

  let errorString = "=> ";

  const skipArgName = isGlobalModifierCommand(command) ||
    isGlobalCommand(command);
  const argsString = invalidArguments.map(
    (arg) => printer.yellow(getInvalidArgumentString(arg, skipArgName)),
  ).join(", ");
  errorString = `${errorString}${argsString}`;

  await printer.error(
    `Parse error: ${commandString}\n  ${errorString}\n\n`,
    Icon.FAILURE,
  );
}

async function printCommandExecutionError(
  context: Context,
  parseResult: ParseResult,
  err: Error,
) {
  const printer = context.getServiceById(PRINTER_SERVICE_ID) as Printer;
  const commandString = getCommandString(printer, parseResult);
  if (err !== undefined) {
    await printer.error(
      `Execution error: ${commandString}\n  => '${err.message}'\n\n`,
      Icon.FAILURE,
    );
  } else {
    await printer.error(
      `Execution error: ${commandString}\n  => error is undefined\n\n`,
      Icon.FAILURE,
    );
  }
}

async function printNoCommandSpecifiedError(context: Context) {
  const printer = context.getServiceById(PRINTER_SERVICE_ID) as Printer;
  await printer.error("No command specified\n\n");
}

async function printUnusedArgsWarning(
  context: Context,
  overallUnusedArgs: ReadonlyArray<string>,
) {
  const printer = context.getServiceById(PRINTER_SERVICE_ID) as Printer;
  if (overallUnusedArgs.length === 1) {
    await printer.warn(
      `Unused arg: ${overallUnusedArgs[0]}\n\n`,
      Icon.ALERT,
    );
  } else {
    await printer.warn(
      `Unused args: ${overallUnusedArgs.join(" ")}\n\n`,
      Icon.ALERT,
    );
  }
}

/**
 * Default implementation of a {@link Runner}.
 *
 * Beyond parsing and execution, this implementation provides user output of errors or warnings while processing via
 * a provided {@link Printer} implementation.
 */
export default class DefaultRunner implements Runner {
  private readonly parser: Parser;

  /**
   * Constructor configures the instance with the specified {@link Parser}.
   *
   * @param parser the {@link Parser} implementation to use.
   */
  public constructor(parser: Parser) {
    this.parser = parser;
  }

  public async run(
    args: ReadonlyArray<string>,
    commandRegistry: CommandRegistry,
    defaultArgumentValuesByCommandName: ReadonlyMap<
      string,
      ArgumentValues | ArgumentSingleValueType
    >,
    context: Context,
    defaultGlobalModifierCommands?: ReadonlyArray<GlobalModifierCommand>,
    defaultCommand?: NonModifierCommand,
  ): Promise<RunResult> {
    const scanResult = this.parser.scanForCommandClauses(args, commandRegistry);

    const globalModifierCommandClauses = [
      ...scanResult.globalModifierCommandClauses,
    ];
    if (defaultGlobalModifierCommands) {
      globalModifierCommandClauses.push(
        ...defaultGlobalModifierCommands.map((command) => {
          return {
            command,
            potentialArgs: [],
          } as GlobalModifierCommandClause;
        }),
      );
    }

    // sort the global modifier clauses in order of execute priority
    const modifierCommandClauses = globalModifierCommandClauses
      .slice()
      .sort((a, b): number => {
        return (a.command.executePriority < b.command.executePriority) ? 1 : -1;
      });

    // maintain a list of overall unused args
    const overallUnusedArgs = [];

    // maintain a list of potential default command clauses (will only be used if a default command was provided)
    const potentialDefaultClauses: Array<
      SubCommandClause | GlobalCommandClause
    > = [];
    let defaultCommandIsGlobal = false;
    let defaultGlobalCommandDefaultArgumentValue:
      | ArgumentSingleValueType
      | undefined;
    let defaultSubCommandDefaultArgumentValues: ArgumentValues | undefined;

    if (defaultCommand) {
      defaultCommandIsGlobal = isGlobalCommand(defaultCommand);
      if (defaultCommandIsGlobal) {
        defaultGlobalCommandDefaultArgumentValue =
          defaultArgumentValuesByCommandName.get(defaultCommand.name) as
            | ArgumentSingleValueType
            | undefined;
      } else {
        defaultSubCommandDefaultArgumentValues =
          defaultArgumentValuesByCommandName.get(defaultCommand.name) as
            | ArgumentValues
            | undefined;
      }
    }

    // if a default command is specified create a potential default clause using the leading args
    // i.e. default command args might have been specified before a global modifier command
    if (defaultCommand) {
      potentialDefaultClauses.push({
        command: defaultCommand,
        potentialArgs: scanResult.unusedLeadingArgs,
      });
    } else {
      overallUnusedArgs.push(...scanResult.unusedLeadingArgs);
    }

    for (let i = 0; i < modifierCommandClauses.length; i++) {
      const globalModifierCommandClause = modifierCommandClauses[i];
      const parseResult = this.parser.parseGlobalCommandClause(
        globalModifierCommandClause,
        defaultArgumentValuesByCommandName.get(
          globalModifierCommandClause.command.name,
        ) as ArgumentSingleValueType | undefined,
      );

      // fast fail on a parse error
      if (parseResult.invalidArguments.length > 0) {
        await printParseResultError(context, parseResult);
        return {
          runState: RunState.PARSE_ERROR,
          command: parseResult.command,
          invalidArguments: parseResult.invalidArguments,
        };
      }

      // if a default command is specified create a potential default clause using the trailing args
      // i.e. default command args might have been specified after a global modifier command
      if (defaultCommand) {
        potentialDefaultClauses.push({
          command: defaultCommand,
          potentialArgs: scanResult.unusedLeadingArgs,
        });
      } else {
        overallUnusedArgs.push(...scanResult.unusedLeadingArgs);
      }

      // run the successfully parsed global modifier
      logger.debug(
        () =>
          `Executing command with name: '${parseResult.command.name}' and args: ${
            JSON.stringify(
              parseResult.populatedArgumentValues as ArgumentValues,
              null,
              2,
            )
          }`,
      );
      try {
        await parseResult.command.execute(
          parseResult.populatedArgumentValues as ArgumentValues,
          context,
        );
      } catch (err) {
        await printCommandExecutionError(context, parseResult, err);
        return {
          runState: RunState.EXECUTION_ERROR,
          command: parseResult.command,
          error: err,
        };
      }
    }

    let parseResult: ParseResult | undefined;

    // parse a non-modifier clause if it was found
    if (scanResult.subCommandClause) {
      parseResult = this.parser.parseSubCommandClause(
        scanResult.subCommandClause,
        defaultArgumentValuesByCommandName.get(
          scanResult.subCommandClause.command.name,
        ) as ArgumentValues | undefined,
      );
    } else if (scanResult.globalCommandClause) {
      parseResult = this.parser.parseGlobalCommandClause(
        scanResult.globalCommandClause,
        defaultArgumentValuesByCommandName.get(
          scanResult.globalCommandClause.command.name,
        ) as ArgumentSingleValueType | undefined,
      );
    }

    if (parseResult) {
      // fail on a parse error
      if (parseResult.invalidArguments.length > 0) {
        await printParseResultError(context, parseResult);
        return {
          runState: RunState.PARSE_ERROR,
          command: parseResult.command,
          invalidArguments: parseResult.invalidArguments,
        };
      }

      // any default command clauses are no longer relevant, therefore shift all potential default clause args to unused args.
      potentialDefaultClauses.forEach(
        (potentialDefaultClause) =>
          overallUnusedArgs.push(...potentialDefaultClause.potentialArgs),
      );

      // otherwise, we successfully parsed a specified non-modifier
      overallUnusedArgs.push(...parseResult.unusedArgs);
    }

    // if we haven't parsed a non-modifier clause, we should try any potential default command clauses
    if (!parseResult) {
      logger.debug(
        "Non-modifier command not found in args, now parsing potential default clauses",
      );
      potentialDefaultClauses.forEach((potentialDefaultClause) => {
        // check if default has now been found, if so remaining default command clauses are no longer
        // relevant, therefore shift all potential default clause args to unused args.
        if (parseResult) {
          overallUnusedArgs.push(...potentialDefaultClause.potentialArgs);
        } else {
          let potentialDefaultParseResult;
          if (defaultCommandIsGlobal) {
            potentialDefaultParseResult = this.parser.parseGlobalCommandClause(
              potentialDefaultClause,
              defaultGlobalCommandDefaultArgumentValue,
            );
          } else {
            potentialDefaultParseResult = this.parser.parseSubCommandClause(
              potentialDefaultClause as SubCommandClause,
              defaultSubCommandDefaultArgumentValues,
            );
          }

          // ignore this clause if there are parse errors, but don't fail
          if (potentialDefaultParseResult.invalidArguments.length > 0) {
            overallUnusedArgs.push(...potentialDefaultClause.potentialArgs);
          } else {
            // save the fact we have a result but don't break the loop as
            // we need all other potential default command clauses to be processed to
            // collate their potential args into unused args.
            parseResult = potentialDefaultParseResult;
            overallUnusedArgs.push(...parseResult.unusedArgs);
          }
        }
      });
    }

    // if still no command has been parsed if a default command was specified we can try with no args
    // i.e. treating all args as unused
    if (!parseResult && defaultCommand) {
      let potentialDefaultParseResult;
      if (defaultCommandIsGlobal) {
        potentialDefaultParseResult = this.parser.parseGlobalCommandClause(
          {
            command: defaultCommand,
            potentialArgs: [],
          },
          defaultGlobalCommandDefaultArgumentValue,
        );
      } else {
        potentialDefaultParseResult = this.parser.parseSubCommandClause(
          {
            command: defaultCommand as SubCommand,
            potentialArgs: [],
          },
          defaultSubCommandDefaultArgumentValues,
        );
      }

      // if we parsed successfully, unused args remains as it was
      if (potentialDefaultParseResult.invalidArguments.length === 0) {
        parseResult = potentialDefaultParseResult;
      }
    }

    // give up if we haven't successfully parsed a non-modifier command by now
    if (parseResult === undefined) {
      await printNoCommandSpecifiedError(context);
      return {
        runState: RunState.NO_COMMAND,
      };
    }

    // warn on unused args
    if (overallUnusedArgs.length > 0) {
      await printUnusedArgsWarning(context, overallUnusedArgs);
    }

    // run the non-modifier command
    try {
      if (parseResult.groupCommand !== undefined) {
        logger.debug(() =>
          `Executing group command with name: '${
            parseResult!.groupCommand!.name
          }'`
        );
        await parseResult.groupCommand.execute({}, context);
      }
      logger.debug(() =>
        `Executing command with name: '${
          parseResult!.command.name
        }' and args: ${
          JSON.stringify(
            parseResult!.populatedArgumentValues as ArgumentValues,
            null,
            2,
          )
        }`
      );
      await parseResult.command.execute(
        parseResult.populatedArgumentValues as ArgumentValues,
        context,
      );
    } catch (err) {
      await printCommandExecutionError(context, parseResult, err);
      return {
        runState: RunState.EXECUTION_ERROR,
        command: parseResult.command,
        error: err,
      };
    }

    return {
      runState: RunState.SUCCESS,
    };
  }
}
