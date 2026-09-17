import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { SyntaxHighlighterService } from "@flowscripter/dynamic-cli-framework-api";
import { SYNTAX_HIGHLIGHTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Command which dumps the configuration loaded by {@link ConfigurationServiceProvider}.
 *
 * Takes a direct reference to {@link ConfigurationServiceProvider.getConfigString}, wired by the
 * provider that constructs this command, rather than looking it up via {@link Context} -
 * deliberately, since a full config dump is not something every command/task should be able to
 * reach through a general lookup (see {@link ConfigurationService}'s doc comment).
 */
export default class DumpConfigCommand implements GlobalCommand {
  readonly name = "dump-config";
  readonly description = "Dump configuration values";

  readonly #getConfigString: () => string;

  public constructor(getConfigString: () => string) {
    this.#getConfigString = getConfigString;
  }

  public async execute(context: Context): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const syntaxHighlighterService = context.getServiceById(
      SYNTAX_HIGHLIGHTER_SERVICE_ID,
    ) as SyntaxHighlighterService;

    await printerService.print(
      `${syntaxHighlighterService.highlight(this.#getConfigString(), "json")}\n`,
    );
  }
}
