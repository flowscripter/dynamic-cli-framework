import type PrettyPrinterService from "../../api/service/core/PrettyPrinterService.ts";
import * as prettier from "prettier";
import type { Plugin } from "prettier";

/**
 * Default implementation of {@link PrettyPrinterService} which provides by default the
 * syntaxes built into prettier.
 */
export default class DefaultPrettyPrinterService
  implements PrettyPrinterService {
  #registeredSyntaxes = new Array<string>();
  #syntaxNameToPluginnMap = new Map<string, Plugin>();

  async #populateBuiltInSyntaxes(): Promise<void> {
    const languages = (await prettier.getSupportInfo()).languages;
    this.#registeredSyntaxes = languages.map((language) =>
      language.name.toLowerCase()
    );
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

    const syntaxPlugin = this.#syntaxNameToPluginnMap.get(
      name,
    );
    if (syntaxPlugin) {
      options.plugins = [syntaxPlugin];
    }

    return prettier.format(text, options);
  }

  async registerSyntax(
    syntaxName: string,
    syntaxPlugin: Plugin,
  ): Promise<void> {
    if (this.#registeredSyntaxes.length === 0) {
      await this.#populateBuiltInSyntaxes();
    }

    const name = syntaxName.toLowerCase();
    if (this.#registeredSyntaxes.includes(name)) {
      throw new Error(`Syntax name already registered: ${name}`);
    }

    this.#registeredSyntaxes.push(name);
    this.#syntaxNameToPluginnMap.set(name, syntaxPlugin);
  }
}
