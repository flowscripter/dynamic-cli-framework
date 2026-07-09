import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Implementation of a {@link GlobalCommand} which outputs the version of the CLI.
 */
export default class VersionCommand implements GlobalCommand {
  readonly name = "version";
  readonly description = "Show version information";
  readonly shortAlias = "v";

  public async execute(context: Context): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    await printerService.print(`${context.cliConfig.version}\n`);
  }
}
