import GlobalModifierCommand from "../../../api/command/GlobalModifierCommand.ts";
import GlobalCommandArgument from "../../../api/argument/GlobalCommandArgument.ts";
import {
  ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "../../../api/argument/ArgumentValueTypes.ts";
import Context from "../../../api/Context.ts";
import PrinterServiceProvider from "../PrinterServiceProvider.ts";

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
    this.#printerServiceProvider.printerService!.darkMode =
      argumentValue as boolean;

    return Promise.resolve();
  }
}
