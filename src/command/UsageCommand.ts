import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Command } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Command printing basic CLI usage.
 */
export default class UsageCommand implements GlobalCommand {
  readonly name = "usage";
  readonly description = "Show usage information";

  readonly #helpCommand: Command;

  public constructor(helpCommand: Command) {
    this.#helpCommand = helpCommand;
  }

  public async execute(context: Context): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;

    await printerService.print(
      `${printerService.secondary("Try running:")}\n\n  ${printerService.primary(
        context.cliConfig.name,
      )} --${printerService.primary(this.#helpCommand.name)}\n\n`,
    );
  }
}
