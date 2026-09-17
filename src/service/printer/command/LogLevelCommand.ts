import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
import { type SingleValueType, ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { Level } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Command allowing the setting of the log level for the {@link PrinterService}.
 */
export default class LogLevelCommand implements GlobalModifierCommand {
  readonly name = "log-level";
  readonly description = "Set the logging threshold";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ValueTypeName.STRING,
    allowableValues: ["DEBUG", "INFO", "WARN", "ERROR"],
    isCaseInsensitive: true,
    defaultValue: "INFO",
    configurationKey: "LOG_LEVEL",
  };
  readonly executePriority: number;

  public constructor(executePriority: number) {
    this.executePriority = executePriority;
  }

  public execute(context: Context, argumentValue: SingleValueType): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const logLevel = argumentValue as string;

    switch (logLevel.toUpperCase()) {
      case "DEBUG":
        printerService.setLevel(Level.DEBUG);
        break;
      case "INFO":
        printerService.setLevel(Level.INFO);
        break;
      case "WARN":
        printerService.setLevel(Level.WARN);
        break;
      case "ERROR":
        printerService.setLevel(Level.ERROR);
        break;
    }

    return Promise.resolve();
  }
}
