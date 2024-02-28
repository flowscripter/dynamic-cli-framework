import PrinterService, {
  Icon,
  PRINTER_SERVICE_ID,
} from "../api/service/core/PrinterService.ts";
import { ParseResult } from "../runtime/parser.ts";
import {
  isGlobalCommand,
  isGlobalModifierCommand,
} from "../api/command/CommandTypeGuards.ts";
import Context from "../api/Context.ts";
import { getInvalidArgumentString } from "../runtime/values/argumentValueValidation.ts";

function getCommandString(
  printerService: PrinterService,
  parseResult: ParseResult,
): string {
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
    return printerService.yellow(
      `${commandString}'${groupCommand.name}:${command.name}'`,
    );
  }
  return printerService.yellow(`${commandString}'${command.name}'`);
}

export async function printParseResultError(
  context: Context,
  parseResult: ParseResult,
) {
  const printerService = context.getServiceById(
    PRINTER_SERVICE_ID,
  ) as PrinterService;
  const commandString = getCommandString(printerService, parseResult);
  const { command, invalidArguments } = parseResult;

  let errorString = "=> ";

  const skipArgName = isGlobalModifierCommand(command) ||
    isGlobalCommand(command);
  const argsString = invalidArguments.map(
    (arg) => printerService.yellow(getInvalidArgumentString(arg, skipArgName)),
  ).join(", ");
  errorString = `${errorString}${argsString}`;

  await printerService.error(
    `Parse error: ${commandString}\n  ${errorString}\n\n`,
    Icon.FAILURE,
  );
}

export async function printCommandExecutionError(
  context: Context,
  parseResult: ParseResult,
  err: Error,
) {
  const printerService = context.getServiceById(
    PRINTER_SERVICE_ID,
  ) as PrinterService;
  const commandString = getCommandString(printerService, parseResult);
  if (err !== undefined) {
    await printerService.error(
      `Execution error: ${commandString}\n  => '${err.message}'\n\n`,
      Icon.FAILURE,
    );
  } else {
    await printerService.error(
      `Execution error: ${commandString}\n  => error is undefined\n\n`,
      Icon.FAILURE,
    );
  }
}

export async function printNoCommandSpecifiedError(context: Context) {
  const printerService = context.getServiceById(
    PRINTER_SERVICE_ID,
  ) as PrinterService;
  await printerService.error("No command specified\n\n");
}

export async function printUnusedArgsWarning(
  context: Context,
  overallUnusedArgs: ReadonlyArray<string>,
) {
  const printerService = context.getServiceById(
    PRINTER_SERVICE_ID,
  ) as PrinterService;
  if (overallUnusedArgs.length === 1) {
    await printerService.warn(
      `Unused arg: ${overallUnusedArgs[0]}\n\n`,
      Icon.ALERT,
    );
  } else {
    await printerService.warn(
      `Unused args: ${overallUnusedArgs.join(" ")}\n\n`,
      Icon.ALERT,
    );
  }
}
