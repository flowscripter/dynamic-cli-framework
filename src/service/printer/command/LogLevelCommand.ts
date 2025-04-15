import type GlobalCommandArgument from "../../../api/argument/GlobalCommandArgument.ts";
import {
  type ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "../../../api/argument/ArgumentValueTypes.ts";
import type GlobalModifierCommand from "../../../api/command/GlobalModifierCommand.ts";
import type Context from "../../../api/Context.ts";
import type PrinterServiceProvider from "../PrinterServiceProvider.ts";
import { Level } from "../../../api/service/core/PrinterService.ts";

/**
 * Command allowing the setting of the log level for {@link PrinterServiceProvider}.
 */
export default class LogLevelCommand implements GlobalModifierCommand {
  readonly name = "log-level";
  readonly description = "Set the logging threshold";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ArgumentValueTypeName.STRING,
    allowableValues: [
      "DEBUG",
      "INFO",
      "WARN",
      "ERROR",
    ],
    isCaseInsensitive: true,
    defaultValue: "INFO",
    configurationKey: "LOG_LEVEL",
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
    const logLevel = argumentValue as string;

    switch (logLevel.toUpperCase()) {
      case "DEBUG":
        this.#printerServiceProvider.printerService!.setLevel(
          Level.DEBUG,
        );
        break;
      case "INFO":
        this.#printerServiceProvider.printerService!.setLevel(
          Level.INFO,
        );
        break;
      case "WARN":
        this.#printerServiceProvider.printerService!.setLevel(
          Level.WARN,
        );
        break;
      case "ERROR":
        this.#printerServiceProvider.printerService!.setLevel(
          Level.ERROR,
        );
        break;
    }

    return Promise.resolve();
  }
}
