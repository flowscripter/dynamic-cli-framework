import type Context from "../../../api/Context.ts";
import type GlobalCommand from "../../../api/command/GlobalCommand.ts";
import type ConfigurationServiceProvider from "../ConfigurationServiceProvider.ts";
import type PrinterService from "../../../api/service/core/PrinterService.ts";
import {
  PRINTER_SERVICE_ID,
} from "../../../api/service/core/PrinterService.ts";
import type SyntaxHighlighterService from "../../../api/service/core/SyntaxHighlighterService.ts";
import {
  SYNTAX_HIGHLIGHTER_SERVICE_ID,
} from "../../../api/service/core/SyntaxHighlighterService.ts";

/**
 * Command which dumps the configuration loaded by the {@link ConfigurationServiceProvider}.
 */
export default class DumpConfigCommand implements GlobalCommand {
  readonly name = "dump-config";
  readonly description = "Dump configuration values";

  readonly #configurationServiceProvider: ConfigurationServiceProvider;

  public constructor(
    configurationServiceProvider: ConfigurationServiceProvider,
  ) {
    this.#configurationServiceProvider = configurationServiceProvider;
  }

  public async execute(
    context: Context,
  ): Promise<void> {
    const printerService = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as PrinterService;
    const syntaxHighlighterService = context.getServiceById(
      SYNTAX_HIGHLIGHTER_SERVICE_ID,
    ) as SyntaxHighlighterService;

    await printerService.print(
      `${
        syntaxHighlighterService.highlight(
          this.#configurationServiceProvider.getConfigString(),
          "json",
        )
      }\n`,
    );
  }
}
