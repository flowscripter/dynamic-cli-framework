import SyntaxHighlighterService from "../../api/service/core/SyntaxHighlighterService.ts";
import {
  emphasize,
  HighlightSyntax,
  jsonSyntaxDefinition,
} from "../../../deps.ts";

/**
 * Default implementation of {@link SyntaxHighlighterService} which has a syntax definition
 * for JSON already registered.
 */
export default class DefaultSyntaxHighlighterService
  implements SyntaxHighlighterService {
  colorEnabled = true;

  constructor() {
    this.registerSyntax("json", jsonSyntaxDefinition);
  }
  getRegisteredSyntaxes(): ReadonlyArray<string> {
    return emphasize.listLanguages();
  }

  highlight(text: string, syntaxName: string): string {
    const name = syntaxName.toLowerCase();
    if (!emphasize.registered(name)) {
      throw new Error(`Syntax name is not registered: ${name}`);
    }

    // skip highlighting if color disabled
    if (!this.colorEnabled) {
      return text;
    }

    return emphasize.highlight(name, text).value;
  }

  registerSyntax(syntaxName: string, syntaxDefinition: HighlightSyntax): void {
    const name = syntaxName.toLowerCase();
    if (emphasize.registered(name)) {
      throw new Error(`Syntax name already registered: ${name}`);
    }
    emphasize.registerLanguage(name, syntaxDefinition);
  }
}
