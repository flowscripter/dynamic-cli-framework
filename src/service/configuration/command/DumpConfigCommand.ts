import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommand } from "@flowscripter/dynamic-cli-framework-api";
import {
  CONFIGURATION_SERVICE_ID,
  type ConfigurationService,
} from "@flowscripter/dynamic-cli-framework-api";
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
    const configurationService = context.getServiceById(
      CONFIGURATION_SERVICE_ID,
    ) as ConfigurationService;

    await printerService.print(
      `${syntaxHighlighterService.highlight(configurationService.getConfigString(), "json")}\n`,
    );
  }
}
