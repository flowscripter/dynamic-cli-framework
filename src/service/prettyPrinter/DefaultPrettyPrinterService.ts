import type { PrettyPrinterService } from "@flowscripter/dynamic-cli-framework-api";
import * as prettier from "prettier/standalone";
import type { Options, Plugin } from "prettier";
import * as babel from "prettier/plugins/babel";
import * as estree from "prettier/plugins/estree";

/**
 * Default implementation of {@link PrettyPrinterService} which provides JSON by default.
 *
 * Only prettier's babel and estree plugins are bundled, which provide the JSON parser and printer.
 * Other syntaxes are added with {@link registerSyntax}.
 */
export default class DefaultPrettyPrinterService implements PrettyPrinterService {
  readonly #registeredSyntaxes = ["json"];
  readonly #plugins: Array<Plugin<unknown>> = [babel, estree as Plugin<unknown>];

  getRegisteredSyntaxes(): Promise<ReadonlyArray<string>> {
    return Promise.resolve(this.#registeredSyntaxes);
  }

  async prettify(text: string, syntaxName: string): Promise<string> {
    const name = syntaxName.toLowerCase();
    if (!this.#registeredSyntaxes.includes(name)) {
      throw new Error(`Syntax name is not registered: ${name}`);
    }

    const options: Options = { parser: syntaxName, plugins: this.#plugins };

    return prettier.format(text, options);
  }

  registerSyntax(syntaxName: string, syntaxPlugin: Plugin<unknown>): Promise<void> {
    const name = syntaxName.toLowerCase();
    if (this.#registeredSyntaxes.includes(name)) {
      return Promise.reject(new Error(`Syntax name already registered: ${name}`));
    }

    this.#registeredSyntaxes.push(name);
    this.#plugins.push(syntaxPlugin);
    return Promise.resolve();
  }
}
