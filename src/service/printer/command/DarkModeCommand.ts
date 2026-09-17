import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
import { type SingleValueType, ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Command allowing the specification of dark/light mode for the {@link PrinterService}.
 */
export default class DarkModeCommand implements GlobalModifierCommand {
  readonly name = "dark-mode";
  readonly description = "Enable dark mode for output";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ValueTypeName.BOOLEAN,
    defaultValue: false,
    configurationKey: "DARK_MODE",
  };
  readonly executePriority: number;

  public constructor(executePriority: number) {
    this.executePriority = executePriority;
  }

  public execute(context: Context, argumentValue: SingleValueType): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    printerService.darkMode = argumentValue as boolean;

    return Promise.resolve();
  }
}
