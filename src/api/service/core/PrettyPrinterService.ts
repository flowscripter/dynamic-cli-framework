export const PRETTY_PRINTER_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/pretty-printer-service";

import type { Plugin as PrettierSyntax } from "prettier";

/**
 * Service providing syntax based pretty printing of text for the CLI using [prettier](https://github.com/prettier/prettier).
 */
export default interface PrettyPrinterService {
  /**
   * Register a new syntax.
   *
   * The recommended way to define a new language syntax plugin is to follow the instructions here:
   *
   * https://prettier.io/docs/plugins#developing-plugins
   *
   * There is a list of already defined languages available for import here:
   *
   * * https://prettier.io/docs/
   * * https://prettier.io/docs/plugins
   *
   * @param syntaxName the name used to refer to the syntax.
   * @param syntaxDefinition the definition for the syntax conforming to the Prettier plugin syntax.
   */
  registerSyntax(
    syntaxName: string,
    syntaxDefinition: PrettierSyntax<unknown>,
  ): Promise<void>;

  /**
   * Return the names of the currently registered syntaxes.
   */
  getRegisteredSyntaxes(): Promise<ReadonlyArray<string>>;

  /**
   * Return a pretty printed version of the provided text using the specified syntax.
   *
   * @param text the text to prettify.
   * @param syntaxName the syntax to use.
   */
  prettify(text: string, syntaxName: string): Promise<string>;
}
