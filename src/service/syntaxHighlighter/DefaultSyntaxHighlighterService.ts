import type SyntaxHighlighterService from "../../api/service/core/SyntaxHighlighterService.ts";
import type { LanguageFn as HighlightSyntax } from "highlight.js";
import { createEmphasize } from "emphasize";
import json from "highlight.js/lib/languages/json";

interface Emphasize {
  listLanguages(): ReadonlyArray<string>;
  registered(name: string): boolean;
  highlight(
    name: string,
    text: string,
    sheet: Record<string, (string) => string> | undefined,
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
  sheet: Record<string, (text: string) => string> | undefined;
  emphasize: Emphasize;

  constructor() {
    this.emphasize = createEmphasize();
    this.registerSyntax("json", json);
  }

  getRegisteredSyntaxes(): ReadonlyArray<string> {
    return this.emphasize.listLanguages();
  }

  highlight(text: string, syntaxName: string): string {
    const name = syntaxName.toLowerCase();
    if (!this.emphasize.registered(name)) {
      throw new Error(`Syntax name is not registered: ${name}`);
    }

    // skip highlighting if color disabled
    if (!this.colorEnabled) {
      return text;
    }

    return this.emphasize.highlight(name, text, this.sheet).value;
  }

  registerSyntax(syntaxName: string, syntaxDefinition: HighlightSyntax): void {
    const name = syntaxName.toLowerCase();
    if (this.emphasize.registered(name)) {
      throw new Error(`Syntax name already registered: ${name}`);
    }
    this.emphasize.register(name, syntaxDefinition);
  }
}
