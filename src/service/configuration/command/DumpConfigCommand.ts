import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommand } from "@flowscripter/dynamic-cli-framework-api";
import type ConfigurationServiceProvider from "../ConfigurationServiceProvider.ts";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { SyntaxHighlighterService } from "@flowscripter/dynamic-cli-framework-api";
import { SYNTAX_HIGHLIGHTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Command which dumps the configuration loaded by the {@link ConfigurationServiceProvider}.
 */
export default class DumpConfigCommand implements GlobalCommand {
  readonly name = "dump-config";
  readonly description = "Dump configuration values";

  readonly #configurationServiceProvider: ConfigurationServiceProvider;

  public constructor(configurationServiceProvider: ConfigurationServiceProvider) {
    this.#configurationServiceProvider = configurationServiceProvider;
  }

  public async execute(context: Context): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const syntaxHighlighterService = context.getServiceById(
      SYNTAX_HIGHLIGHTER_SERVICE_ID,
    ) as SyntaxHighlighterService;

    await printerService.print(
      `${syntaxHighlighterService.highlight(
        this.#configurationServiceProvider.getConfigString(),
        "json",
      )}\n`,
    );
  }
}
