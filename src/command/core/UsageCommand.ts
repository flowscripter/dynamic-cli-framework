import { ArgumentValues } from "../../api/argument/ArgumentValueTypes.ts";
import Context from "../../api/Context.ts";
import GlobalCommand from "../../api/command/GlobalCommand.ts";
import Command from "../../api/command/Command.ts";
import Printer, { PRINTER_SERVICE_ID } from "../../api/service/core/Printer.ts";

/**
 * Command printing basic CLI usage.
 */
export default class UsageCommand implements GlobalCommand {
  readonly name = "usage";
  readonly description = "Show usage information";

  private readonly helpCommand: Command;

  public constructor(
    helpCommand: Command,
  ) {
    this.helpCommand = helpCommand;
  }

  public async execute(
    _argumentValues: ArgumentValues,
    context: Context,
  ): Promise<void> {
    const printer = context.getServiceById(PRINTER_SERVICE_ID) as Printer;

    await printer.print(
      `\n${printer.secondary("Try running:")}\n\n  ${
        printer.primary(context.cliConfig.name)
      } --${printer.primary(this.helpCommand.name)}\n\n`,
    );
  }
}
