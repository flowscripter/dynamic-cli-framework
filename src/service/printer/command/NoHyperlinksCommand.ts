import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
import {
  type ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type PrinterServiceProvider from "../PrinterServiceProvider.ts";

export default class NoHyperlinksCommand implements GlobalModifierCommand {
  readonly name = "no-hyperlinks";
  readonly description = "Disable hyperlinks for output";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ArgumentValueTypeName.BOOLEAN,
    defaultValue: false,
    configurationKey: "NO_HYPERLINKS",
  };
  readonly executePriority: number;

  readonly #printerServiceProvider: PrinterServiceProvider;

  public constructor(printerServiceProvider: PrinterServiceProvider, executePriority: number) {
    this.#printerServiceProvider = printerServiceProvider;
    this.executePriority = executePriority;
  }

  public execute(_context: Context, argumentValue: ArgumentSingleValueType): Promise<void> {
    this.#printerServiceProvider.printerService!.hyperlinksEnabled = !argumentValue as boolean;

    return Promise.resolve();
  }
}
