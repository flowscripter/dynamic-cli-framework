import GlobalModifierCommand from "../../api/command/GlobalModifierCommand.ts";
import GlobalCommandArgument from "../../api/argument/GlobalCommandArgument.ts";
import {
  ArgumentValues,
  ArgumentValueTypeName,
} from "../../api/argument/ArgumentValueTypes.ts";
import Context from "../../api/Context.ts";
import PrinterService from "../../service/core/PrinterService.ts";

/**
 * Command allowing the disabling of color for {@link PrinterService}.
 */
export default class NoColorCommand implements GlobalModifierCommand {
  readonly name = "no-color";
  readonly description = "Disable color for output";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    name: "no-color",
    type: ArgumentValueTypeName.BOOLEAN,
    defaultValue: true,
    configurationKey: "NO_COLOR",
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
    const noColor = argumentValues[this.argument.name] as boolean;

    this.printerService.printer!.colorEnabled = !noColor;

    return Promise.resolve();
  }
}
