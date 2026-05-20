import type GlobalModifierCommand from "../../../api/command/GlobalModifierCommand.ts";
import type GlobalCommandArgument from "../../../api/argument/GlobalCommandArgument.ts";
import {
  type ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "../../../api/argument/ArgumentValueTypes.ts";
import type Context from "../../../api/Context.ts";
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
    this.#printerServiceProvider.printerService!.hyperlinksEnabled =
      !argumentValue as boolean;

    return Promise.resolve();
  }
}
