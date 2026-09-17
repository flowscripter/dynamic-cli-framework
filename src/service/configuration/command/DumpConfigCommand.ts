import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommand } from "@flowscripter/dynamic-cli-framework-api";
import {
  CONFIG_LOCATION_SERVICE_ID,
  type ConfigLocationService,
} from "../ConfigurationServiceProvider.ts";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { SyntaxHighlighterService } from "@flowscripter/dynamic-cli-framework-api";
import { SYNTAX_HIGHLIGHTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Command which dumps the configuration loaded by {@link ConfigurationServiceProvider}.
 */
export default class DumpConfigCommand implements GlobalCommand {
  readonly name = "dump-config";
  readonly description = "Dump configuration values";

  public async execute(context: Context): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const syntaxHighlighterService = context.getServiceById(
      SYNTAX_HIGHLIGHTER_SERVICE_ID,
    ) as SyntaxHighlighterService;
    const configLocationService = context.getServiceById(
      CONFIG_LOCATION_SERVICE_ID,
    ) as ConfigLocationService;

    await printerService.print(
      `${syntaxHighlighterService.highlight(configLocationService.getConfigString(), "json")}\n`,
    );
  }
}
