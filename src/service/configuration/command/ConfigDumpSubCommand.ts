import type DefaultConfigurationService from "../DefaultConfigurationService.ts";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { Option } from "@flowscripter/dynamic-cli-framework-api";
import type { Positional } from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { SyntaxHighlighterService } from "@flowscripter/dynamic-cli-framework-api";
import { SYNTAX_HIGHLIGHTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Member of the `config` group which dumps the configuration loaded by
 * {@link DefaultConfigurationService}, with secrets masked.
 */
export default class ConfigDumpSubCommand implements SubCommand {
  readonly name = "dump";
  readonly description = "Dump configuration values";
  readonly options: ReadonlyArray<Option> = [];
  readonly positionals: ReadonlyArray<Positional> = [];

  readonly #configurationService: DefaultConfigurationService;

  public constructor(configurationService: DefaultConfigurationService) {
    this.#configurationService = configurationService;
  }

  public async execute(context: Context): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const syntaxHighlighterService = context.getServiceById(
      SYNTAX_HIGHLIGHTER_SERVICE_ID,
    ) as SyntaxHighlighterService;

    await printerService.print(
      `${syntaxHighlighterService.highlight(this.#configurationService.getMaskedConfigString(), "json")}\n`,
    );
  }
}
