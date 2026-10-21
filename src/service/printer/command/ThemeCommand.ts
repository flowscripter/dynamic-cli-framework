import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
import { type SingleValueType, ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Command allowing the specification of the dark/light theme for the {@link PrinterService}.
 *
 * With the `auto` value the terminal background is detected and light is used if it cannot be determined.
 */
export default class ThemeCommand implements GlobalModifierCommand {
  readonly name = "theme";
  readonly description = "Theme for output";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ValueTypeName.STRING,
    defaultValue: "auto",
    allowableValues: ["auto", "dark", "light"],
    configurationKey: "THEME",
  };
  readonly executePriority: number;
  readonly #detect: (() => Promise<boolean | undefined>) | undefined;

  /**
   * @param executePriority the priority of the command.
   * @param detect optional function detecting whether the terminal background is dark.
   */
  public constructor(executePriority: number, detect?: () => Promise<boolean | undefined>) {
    this.executePriority = executePriority;
    this.#detect = detect;
  }

  public async execute(context: Context, argumentValue: SingleValueType): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;

    if (argumentValue === "auto") {
      printerService.darkMode =
        printerService.colorEnabled && this.#detect !== undefined
          ? ((await this.#detect()) ?? false)
          : false;
    } else {
      printerService.darkMode = argumentValue === "dark";
    }
  }
}
