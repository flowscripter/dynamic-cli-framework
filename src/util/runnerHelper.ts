import type PrinterService from "../api/service/core/PrinterService.ts";
import {
  Icon,
  PRINTER_SERVICE_ID,
} from "../api/service/core/PrinterService.ts";
import type { ParseResult } from "../runtime/parser.ts";
import {
  isGlobalCommand,
  isGlobalModifierCommand,
} from "../runtime/command/CommandTypeGuards.ts";
import type Context from "../api/Context.ts";
import { getInvalidArgumentString } from "../runtime/values/argumentValueValidation.ts";

function getCommandString(
  printerService: PrinterService,
  parseResult: ParseResult,
): string {
  const { command, groupCommand } = parseResult;

  if (groupCommand) {
    return printerService.yellow(
      `'${groupCommand.name}:${command.name}'`,
    );
  }
  return printerService.yellow(`'${command.name}'`);
}

export async function printParseResultError(
  context: Context,
  parseResult: ParseResult,
  isDefaultCommand = false,
) {
  const printerService = context.getServiceById(
    PRINTER_SERVICE_ID,
  ) as PrinterService;
  const commandErrorString = isDefaultCommand
    ? "Parse error: "
    : `Parse error for command: ${
      getCommandString(printerService, parseResult)
    }`;
  const { command, invalidArguments } = parseResult;

  let errorString = "=> ";

  const skipArgName = isGlobalModifierCommand(command) ||
    isGlobalCommand(command);
  const argsString = invalidArguments.map(
    (arg) => getInvalidArgumentString(arg, skipArgName),
  ).join(", ");
  errorString = `${errorString}${printerService.yellow(argsString)}`;

  await printerService.error(
    `${commandErrorString}\n  ${errorString}\n\n`,
    Icon.FAILURE,
  );
}

export async function printCommandExecutionError(
  context: Context,
  parseResult: ParseResult,
  err: Error,
  isDefaultCommand = false,
) {
  const printerService = context.getServiceById(
    PRINTER_SERVICE_ID,
  ) as PrinterService;
  const commandErrorString = isDefaultCommand
    ? "Execution error: "
    : `Execution error for command: ${
      getCommandString(printerService, parseResult)
    }`;
  if (err !== undefined) {
    await printerService.error(
      `${commandErrorString}\n  => ${printerService.yellow(err.message)}\n\n`,
      Icon.FAILURE,
    );
  } else {
    await printerService.error(
      `${commandErrorString}\n  => ${
        printerService.yellow("error is undefined")
      }\n\n`,
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
