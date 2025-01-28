import type GlobalModifierCommand from "../../../api/command/GlobalModifierCommand.ts";
import type GlobalCommandArgument from "../../../api/argument/GlobalCommandArgument.ts";
import {
  type ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "../../../api/argument/ArgumentValueTypes.ts";
import type Context from "../../../api/Context.ts";
import type PrinterServiceProvider from "../PrinterServiceProvider.ts";

/**
 * Command allowing the disabling of color for {@link PrinterServiceProvider}.
 */
export default class NoColorCommand implements GlobalModifierCommand {
  readonly name = "no-color";
  readonly description = "Disable color for output";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ArgumentValueTypeName.BOOLEAN,
    defaultValue: false,
    configurationKey: "NO_COLOR",
  };
  readonly executePriority: number;

  readonly #printerServiceProvider: PrinterServiceProvider;

  public constructor(
    printerServiceProvider: PrinterServiceProvider,
    executePriority: number,
  ) {
    this.#printerServiceProvider = printerServiceProvider;
    this.executePriority = executePriority;
  }

  public execute(
    _context: Context,
    argumentValue: ArgumentSingleValueType,
  ): Promise<void> {
    this.#printerServiceProvider.printerService!.colorEnabled =
      !argumentValue as boolean;

    return Promise.resolve();
  }
}
