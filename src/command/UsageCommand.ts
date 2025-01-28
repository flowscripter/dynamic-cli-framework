import type Context from "../api/Context.ts";
import type GlobalCommand from "../api/command/GlobalCommand.ts";
import type Command from "../api/command/Command.ts";
import type PrinterService from "../api/service/core/PrinterService.ts";
import { PRINTER_SERVICE_ID } from "../api/service/core/PrinterService.ts";

/**
 * Command printing basic CLI usage.
 */
export default class UsageCommand implements GlobalCommand {
  readonly name = "usage";
  readonly description = "Show usage information";

  readonly #helpCommand: Command;

  public constructor(
    helpCommand: Command,
  ) {
    this.#helpCommand = helpCommand;
  }

  public async execute(
    context: Context,
  ): Promise<void> {
    const printerService = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as PrinterService;

    await printerService.print(
      `${printerService.secondary("Try running:")}\n\n  ${
        printerService.primary(context.cliConfig.name)
      } --${printerService.primary(this.#helpCommand.name)}\n\n`,
    );
  }
}
