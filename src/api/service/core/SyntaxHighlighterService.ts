import type { LanguageFn as HighlightSyntax } from "highlight.js";

export const SYNTAX_HIGHLIGHTER_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/highlighter-service";

/**
 * Service providing syntax based color highlighting of text for the CLI using [highlight.js](https://highlightjs.org).
 */
export default interface SyntaxHighlighterService {
  /**
   * Register a new syntax.
   *
   * The recommended way to define a new language syntax is follow the instructions here:
   *
   * * https://highlightjs.readthedocs.io/en/latest/language-contribution.html
   * * https://highlightjs.readthedocs.io/en/latest/building-testing.html
   * * https://github.com/highlightjs/highlight.js/blob/main/docs/language-guide.rst
   *
   * There is a list of already defined languages available for import here:
   *
   * https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md
   *
   * @param syntaxName the name used to refer to the syntax.
   * @param syntaxDefinition the definition for the syntax conforming to the Highlight JS
   * [language definition syntax]().
   */
  registerSyntax(syntaxName: string, syntaxDefinition: HighlightSyntax): void;

  /**
   * Return the names of the currently registered syntaxes.
   */
  getRegisteredSyntaxes(): ReadonlyArray<string>;

  /**
   * Return a syntactically highlighted version of the provided text using the specified syntax.
   * The returned text will include appropriate ASCII color codes.
   *
   * @param text the text to highlight.
   * @param syntaxName the syntax to use.
   */
  highlight(text: string, syntaxName: string): string;
}
