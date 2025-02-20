import type Context from "../api/Context.ts";
import type GlobalCommand from "../api/command/GlobalCommand.ts";
import type PrinterService from "../api/service/core/PrinterService.ts";
import { PRINTER_SERVICE_ID } from "../api/service/core/PrinterService.ts";

/**
 * Implementation of a {@link GlobalCommand} which outputs the version of the CLI.
 */
export default class VersionCommand implements GlobalCommand {
  readonly name = "version";
  readonly description = "Show version information";
  readonly shortAlias = "v";

  public async execute(
    context: Context,
  ): Promise<void> {
    const printerService = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as PrinterService;
    await printerService.print(`${context.cliConfig.version}\n`);
  }
}
