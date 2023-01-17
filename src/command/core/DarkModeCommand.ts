import GlobalModifierCommand from "../../api/command/GlobalModifierCommand.ts";
import GlobalCommandArgument from "../../api/argument/GlobalCommandArgument.ts";
import {
  ArgumentValues,
  ArgumentValueTypeName,
} from "../../api/argument/ArgumentValueTypes.ts";
import Context from "../../api/Context.ts";
import PrinterService from "../../service/core/PrinterService.ts";

/**
 * Command allowing the specification of dark/light mode for {@link PrinterService}.
 */
export default class DarkModeCommand implements GlobalModifierCommand {
  readonly name = "dark-mode";
  readonly description = "Enable dark mode for output";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    name: "dark-mode",
    type: ArgumentValueTypeName.BOOLEAN,
    defaultValue: false,
    configurationKey: "DARK_MODE",
  };
  readonly executePriority: number;

  private readonly printerService: PrinterService;

  public constructor(
    printerService: PrinterService,
    executePriority: number,
  ) {
    this.printerService = printerService;
    this.executePriority = executePriority;
  }

  public execute(
    argumentValues: ArgumentValues,
    _context: Context,
  ): Promise<void> {
    const darkMode = argumentValues[this.argument.name] as boolean;

    this.printerService.printer!.darkMode = darkMode;

    return Promise.resolve();
  }
}
