import type { LanguageFn as HighlightSyntax } from "highlight.js";

export const SYNTAX_HIGHLIGHTER_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/syntax-highlighter-service";

/**
 * Color scheme for syntax highlighting.
 *
 * The keys are the names of the defined [highlight.js scopes](https://highlightjs.readthedocs.io/en/latest/css-classes-reference.html).
 *
 * The values are colors expressed as a hex formatted string e.g. "0xrrggbb".
 *
 * The scheme does not need to list all scopes exhaustively.
 */
export type ColorScheme = Record<string, string>;

/**
 * Service providing syntax based color highlighting of text for the CLI using [highlight.js](https://github.com/highlightjs/highlight.js).
 */
export default interface SyntaxHighlighterService {
  /**
   * Register a new syntax.
   *
   * The recommended way to define a new language syntax is to follow the instructions here:
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
   * language definition syntax.
   */
  registerSyntax(syntaxName: string, syntaxDefinition: HighlightSyntax): void;

  /**
   * Return the names of the currently registered syntaxes.
   */
  getRegisteredSyntaxes(): ReadonlyArray<string>;

  /**
   * Return a syntactically highlighted version of the provided text using the specified syntax.
   * The returned text will include appropriate color styling. An optional {@link ColorScheme} can be provided.
   *
   * @param text the text to highlight.
   * @param syntaxName the syntax to use.
   * @param colorScheme the color scheme to use.
   */
  highlight(
    text: string,
    syntaxName: string,
    colorScheme?: ColorScheme,
  ): string;
}
