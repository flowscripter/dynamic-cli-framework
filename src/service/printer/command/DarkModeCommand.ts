import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
import {
  type ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type PrinterServiceProvider from "../PrinterServiceProvider.ts";

/**
 * Command allowing the specification of dark/light mode for {@link PrinterServiceProvider}.
 */
export default class DarkModeCommand implements GlobalModifierCommand {
  readonly name = "dark-mode";
  readonly description = "Enable dark mode for output";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ArgumentValueTypeName.BOOLEAN,
    defaultValue: false,
    configurationKey: "DARK_MODE",
  };
  readonly executePriority: number;

  readonly #printerServiceProvider: PrinterServiceProvider;

  public constructor(printerServiceProvider: PrinterServiceProvider, executePriority: number) {
    this.#printerServiceProvider = printerServiceProvider;
    this.executePriority = executePriority;
  }

  public execute(_context: Context, argumentValue: ArgumentSingleValueType): Promise<void> {
    this.#printerServiceProvider.printerService!.darkMode = argumentValue as boolean;

    return Promise.resolve();
  }
}
