import Context from "../api/Context.ts";
import GlobalCommand from "../api/command/GlobalCommand.ts";
import Command from "../api/command/Command.ts";
import PrinterService, {
  PRINTER_SERVICE_ID,
} from "../api/service/core/PrinterService.ts";

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
    context: Context,
  ): Promise<void> {
    const printerService = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as PrinterService;

    await printerService.print(
      `\n${printerService.secondary("Try running:")}\n\n  ${
        printerService.primary(context.cliConfig.name)
      } --${printerService.primary(this.helpCommand.name)}\n\n`,
    );
  }
}
