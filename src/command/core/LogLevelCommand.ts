import GlobalCommandArgument from "../../api/argument/GlobalCommandArgument.ts";
import {
  ArgumentValues,
  ArgumentValueTypeName,
} from "../../api/argument/ArgumentValueTypes.ts";
import GlobalModifierCommand from "../../api/command/GlobalModifierCommand.ts";
import { Level } from "../../api/service/core/Printer.ts";
import PrinterService from "../../service/core/PrinterService.ts";
import Context from "../../api/runtime/Context.ts";

/**
 * Command allowing the setting of the log level for {@link PrinterService}.
 */
export default class LogLevelCommand implements GlobalModifierCommand {
  readonly name = "log-level";
  readonly description = "Set the logging threshold";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    name: "level",
    type: ArgumentValueTypeName.STRING,
    allowableValues: [
      "DEBUG",
      "INFO",
      "WARN",
      "ERROR",
    ],
    defaultValue: "INFO",
    configurationKey: "LOG_LEVEL",
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
    const logLevel = argumentValues[this.argument.name] as string;

    switch (logLevel) {
      case "DEBUG":
        this.printerService.printer!.setLevel(Level.DEBUG);
        break;
      case "INFO":
        this.printerService.printer!.setLevel(Level.INFO);
        break;
      case "WARN":
        this.printerService.printer!.setLevel(Level.WARN);
        break;
      case "ERROR":
        this.printerService.printer!.setLevel(Level.ERROR);
        break;
    }

    return Promise.resolve();
  }
}
