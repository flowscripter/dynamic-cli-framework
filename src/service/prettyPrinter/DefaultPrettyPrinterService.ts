import type PrettyPrinterService from "../../api/service/core/PrettyPrinterService.ts";
import * as prettier from "prettier";
import type { Plugin as PrettierSyntax } from "prettier";

/**
 * Default implementation of {@link PrettyPrinterService} which already has syntax definitions
 * for those built into prettier.
 */
export default class DefaultPrettyPrinterService
  implements PrettyPrinterService {
  #registeredSyntaxes = new Array<string>();
  #syntaxNameToDefinitionMap = new Map<string, PrettierSyntax>();

  async #populateBuiltInSyntaxes(): Promise<void> {
    const languages = (await prettier.getSupportInfo()).languages;
    this.#registeredSyntaxes = languages.map((language) => language.name.toLowerCase());
  }

  async getRegisteredSyntaxes(): Promise<ReadonlyArray<string>> {
    if (this.#registeredSyntaxes.length === 0) {
      await this.#populateBuiltInSyntaxes();
    }

    return this.#registeredSyntaxes;
  }

  async prettify(text: string, syntaxName: string): Promise<string> {
    if (this.#registeredSyntaxes.length === 0) {
      await this.#populateBuiltInSyntaxes();
    }

    const name = syntaxName.toLowerCase();
    if (!this.#registeredSyntaxes.includes(name)) {
      throw new Error(`Syntax name is not registered: ${name}`);
    }

    const options: prettier.Options = { parser: syntaxName };

    const syntaxDefinition = this.#syntaxNameToDefinitionMap.get(
      name,
    );
    if (syntaxDefinition) {
      options.plugins = [syntaxDefinition];
    }

    return prettier.format(text, options);
  }

  async registerSyntax(
    syntaxName: string,
    syntaxDefinition: PrettierSyntax,
  ): Promise<void> {
    if (this.#registeredSyntaxes.length === 0) {
      await this.#populateBuiltInSyntaxes();
    }

    const name = syntaxName.toLowerCase();
    if (this.#registeredSyntaxes.includes(name)) {
      throw new Error(`Syntax name already registered: ${name}`);
    }

    this.#registeredSyntaxes.push(name);
    this.#syntaxNameToDefinitionMap.set(name, syntaxDefinition);
  }
}
