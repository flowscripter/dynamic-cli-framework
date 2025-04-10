import type SyntaxHighlighterService from "../../api/service/core/SyntaxHighlighterService.ts";
import type { LanguageFn as HighlightSyntax } from "highlight.js";
import { createEmphasize } from "emphasize";
import json from "highlight.js/lib/languages/json";
import { ColorScheme } from "../../api/service/core/SyntaxHighlighterService.ts";

type Sheet = Record<string, (string) => string> | undefined;

interface Emphasize {
  listLanguages(): ReadonlyArray<string>;
  registered(name: string): boolean;
  highlight(
    name: string,
    text: string,
    sheet: Sheet,
  ): { value: string };
  register(name: string, syntax: HighlightSyntax): void;
}

/**
 * Default implementation of {@link SyntaxHighlighterService} which has a syntax definition
 * for JSON already registered.
 */
export default class DefaultSyntaxHighlighterService
  implements SyntaxHighlighterService {
  colorEnabled = true;
  colorFunction: (text: string, hexFormattedColor: string) => string;

  emphasize: Emphasize;

  constructor() {
    this.emphasize = createEmphasize();
    this.registerSyntax("json", json);
  }

  getRegisteredSyntaxes(): ReadonlyArray<string> {
    return this.emphasize.listLanguages();
  }

  highlight(
    text: string,
    syntaxName: string,
    colorScheme?: ColorScheme,
  ): string {
    const name = syntaxName.toLowerCase();
    if (!this.emphasize.registered(name)) {
      throw new Error(`Syntax name is not registered: ${name}`);
    }

    // skip highlighting if color disabled
    if (!this.colorEnabled) {
      return text;
    }

    let sheet: Sheet;

    // if a color scheme is provided, create a sheet of color functions
    if (colorScheme && this.colorFunction) {
      sheet = {};
      for (const [key, value] of Object.entries(colorScheme)) {
        if (value) {
          sheet[key] = (text: string) => this.colorFunction(text, value);
        }
      }
    }

    return this.emphasize.highlight(name, text, sheet).value;
  }

  registerSyntax(syntaxName: string, syntaxDefinition: HighlightSyntax): void {
    const name = syntaxName.toLowerCase();
    if (this.emphasize.registered(name)) {
      throw new Error(`Syntax name already registered: ${name}`);
    }
    this.emphasize.register(name, syntaxDefinition);
  }
}
