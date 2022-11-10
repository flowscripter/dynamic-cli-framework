import Runner from "../api/runtime/Runner.ts";
import Context from "../api/runtime/Context.ts";
import Parser, {
  GlobalCommandClause,
  InvalidArgument,
  InvalidArgumentReason,
  ParseResult,
  SubCommandClause,
} from "../api/runtime/Parser.ts";
import { RunResult } from "../api/RunResult.ts";
import CLIConfig from "../api/CLIConfig.ts";
import Printer, { Icon } from "../api/service/core/Printer.ts";
import CommandRegistry from "../api/registry/CommandRegistry.ts";
import { NonModifierCommand } from "../api/command/NonModifierCommand.ts";
import {
  isGlobalCommand,
  isGlobalModifierCommand,
  isGroupCommand,
} from "../api/command/CommandTypeGuards.ts";
import SubCommand from "../api/command/SubCommand.ts";
import {
  ArgumentSingleValueType,
  ArgumentValues,
} from "../api/argument/ArgumentValueTypes.ts";
import getLogger from "./util/logger.ts";

const logger = getLogger("DefaultRunner");

/**
 * Default implementation of a {@link Runner}.
 *
 * Beyond parsing and execution, this implementation provides user output of errors or warnings while processing via
 * a provided {@link Printer} implementation.
 */
export default class DefaultRunner implements Runner {
  private readonly parser: Parser;
  private readonly printer: Printer;

  /**
   * Constructor configures the instance with the specified {@link Parser}, {@link Printer} and {@CliConfiguration} instances.
   *
   * @param parser the {@link Parser} implementation to use.
   * @param printer the {@link Printer} implementation to use.
   */
  public constructor(parser: Parser, printer: Printer) {
    this.parser = parser;
    this.printer = printer;
  }

  private getInvalidArgumentString(
    invalidArgument: InvalidArgument,
    skipArgName: boolean,
  ): string {
    let argString = "";
    if (!skipArgName && (invalidArgument.name !== undefined)) {
      argString = invalidArgument.name;
      if (invalidArgument.value !== undefined) {
        if (typeof invalidArgument.value === "object") {
          argString = `${argString}=${JSON.stringify(invalidArgument.value)} `;
        } else {
          argString = `${argString}=${invalidArgument.value} `;
        }
      } else {
        argString = `${argString} `;
      }
    } else if (invalidArgument.value !== undefined) {
      argString = `${invalidArgument.value} `;
    }

    let invalidString;
    switch (invalidArgument.reason) {
      case InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES:
        invalidString = "(illegal multiple values)";
        break;
      case InvalidArgumentReason.ILLEGAL_VALUE:
        invalidString = "(illegal value)";
        break;
      case InvalidArgumentReason.INCORRECT_VALUE_TYPE:
        invalidString = "(incorrect type)";
        break;
      case InvalidArgumentReason.MISSING_VALUE:
        invalidString = "(missing value)";
        break;
      case InvalidArgumentReason.ILLEGAL_SPARSE_ARRAY:
        invalidString = "(sparse array values)";
        break;
      case InvalidArgumentReason.UNKNOWN_PROPERTY:
        invalidString = "(unknown property)";
        break;
      default:
        invalidString = "";
        break;
    }
    return `${argString}${invalidString}`;
  }

  private printParseResultError(parseResult: ParseResult): void {
    const { command, groupCommand, invalidArguments } = parseResult;

    let errorString = "Parse error for";
    if (isGlobalCommand(command)) {
      errorString = `${errorString} global command `;
    } else if (isGlobalModifierCommand(command)) {
      errorString = `${errorString} global modifier command `;
    } else {
      errorString = `${errorString} command `;
    }
    if (groupCommand) {
      errorString = `${errorString}${
        this.printer.yellow(`${groupCommand.name}:`)
      }`;
    }
    errorString = `${errorString}${this.printer.yellow(command.name)}`;
    if (invalidArguments.length > 0) {
      errorString = `${errorString} with`;
      if (invalidArguments.length === 1) {
        errorString = `${errorString} arg `;
      } else {
        errorString = `${errorString} args `;
      }
      const skipArgName = isGlobalModifierCommand(command) ||
        isGlobalCommand(command);
      const argsString = invalidArguments.map(
        (arg) =>
          this.printer.yellow(this.getInvalidArgumentString(arg, skipArgName)),
      ).join(", ");
      errorString = `${errorString}${argsString}`;
    }
    this.printer.error(`${errorString}\n`, Icon.FAILURE);
  }

  private printCommandExecutionError(parseResult: ParseResult, err: Error) {
    const { command, groupCommand, argumentValues } = parseResult;

    let commandString;
    if (isGlobalCommand(command)) {
      commandString = "global command ";
    } else if (isGlobalModifierCommand(command)) {
      commandString = "global modifier command ";
    } else if (isGroupCommand(command)) {
      commandString = "group command ";
    } else {
      commandString = "command ";
    }
    if (groupCommand) {
      commandString = `${commandString}${
        this.printer.yellow(`${groupCommand.name}:`)
      }`;
    }
    commandString = `${commandString}${this.printer.yellow(command.name)}`;
    const keys = Object.keys(argumentValues);
    if (keys.length > 0) {
      commandString = `${commandString} with`;
      if (keys.length === 1) {
        commandString = `${commandString} arg `;
      } else {
        commandString = `${commandString} args `;
      }

      const skipArgName = isGlobalModifierCommand(command) ||
        isGlobalCommand(command);
      commandString += Object.keys(argumentValues).map((arg) => {
        if (skipArgName) {
          return this.printer.yellow(`${argumentValues[arg]}`);
        }
        return this.printer.yellow(`${arg}=${argumentValues[arg]}`);
      }).join(", ");
    }

    this.printer.error(
      `Error running: ${commandString}\n  ${this.printer.red(err.message)}\n`,
      Icon.FAILURE,
    );
  }

  private printNoCommandSpecifiedError() {
    this.printer.error("No command specified");
  }

  private printUnusedArgsWarning(overallUnusedArgs: ReadonlyArray<string>) {
    if (overallUnusedArgs.length === 1) {
      this.printer.warn(
        `Unused arg: ${this.printer.yellow(overallUnusedArgs[0])}\n`,
        Icon.ALERT,
      );
    } else {
      this.printer.warn(
        `Unused args: ${this.printer.yellow(overallUnusedArgs.join(" "))}\n`,
        Icon.ALERT,
      );
    }
  }

  public async run(
    args: ReadonlyArray<string>,
    commandRegistry: CommandRegistry,
    cliConfig: CLIConfig,
    context: Context,
    defaultCommand?: NonModifierCommand,
  ): Promise<RunResult> {
    const scanResult = this.parser.scanForCommandClauses(args, commandRegistry);

    // sort the global modifier clauses in order of execute priority
    const modifierCommandClauses = scanResult.globalModifierCommandClauses
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
        defaultGlobalCommandDefaultArgumentValue = cliConfig
          .getDefaultArgumentValueForGlobalCommand(defaultCommand.name);
      } else {
        defaultSubCommandDefaultArgumentValues = cliConfig
          .getDefaultArgumentValuesForSubCommand(defaultCommand.name);
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

    for (const globalModifierCommandClause of modifierCommandClauses) {
      const parseResult = this.parser.parseGlobalCommandClause(
        globalModifierCommandClause,
        cliConfig.getDefaultArgumentValueForGlobalCommand(
          globalModifierCommandClause.command.name,
        ),
      );

      // fast fail on a parse error
      if (parseResult.invalidArguments.length > 0) {
        this.printParseResultError(parseResult);
        return RunResult.PARSE_ERROR;
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
            JSON.stringify(parseResult.argumentValues)
          }`,
      );
      try {
        await parseResult.command.execute(parseResult.argumentValues, context);
      } catch (err) {
        this.printCommandExecutionError(parseResult, err);
        return RunResult.COMMAND_ERROR;
      }
    }

    let parseResult: ParseResult | undefined;

    // parse a non-modifier clause if it was found
    if (scanResult.subCommandClause) {
      parseResult = this.parser.parseSubCommandClause(
        scanResult.subCommandClause,
        cliConfig.getDefaultArgumentValuesForSubCommand(
          scanResult.subCommandClause.command.name,
        ),
      );
    } else if (scanResult.globalCommandClause) {
      parseResult = this.parser.parseGlobalCommandClause(
        scanResult.globalCommandClause,
        cliConfig.getDefaultArgumentValueForGlobalCommand(
          scanResult.globalCommandClause.command.name,
        ),
      );
    }

    if (parseResult) {
      // fail on a parse error
      if (parseResult.invalidArguments.length > 0) {
        return RunResult.PARSE_ERROR;
      }

      // any default command clauses are no longer relevant, therefore shift all potential default clause args to unused args.
      potentialDefaultClauses.forEach(
        (potentialDefaultClause) =>
          overallUnusedArgs.push(...potentialDefaultClause.potentialArgs),
      );

      // otherwise, we successfully parsed a specified non-modifier
      overallUnusedArgs.push(...parseResult.unusedTrailingArgs);
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
            // save the fact we have a result but don't break the loop
            // we need all other potential default command clauses to be processed to
            // collate their potential args into unused args.
            parseResult = potentialDefaultParseResult;
            overallUnusedArgs.push(...parseResult.unusedTrailingArgs);
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
      this.printNoCommandSpecifiedError();
      return RunResult.PARSE_ERROR;
    }

    // warn on unused args
    if (overallUnusedArgs.length > 0) {
      this.printUnusedArgsWarning(overallUnusedArgs);
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
        }' and args: ${JSON.stringify(parseResult!.argumentValues)}`
      );
      await parseResult.command.execute(parseResult.argumentValues, context);
    } catch (err) {
      this.printCommandExecutionError(parseResult, err);
      return RunResult.COMMAND_ERROR;
    }

    return RunResult.SUCCESS;
  }
}
