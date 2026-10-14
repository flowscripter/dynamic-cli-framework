import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
import { type SingleValueType, ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { detectDarkBackground } from "../../../terminal/BackgroundDetector.ts";

/**
 * Command allowing the specification of the dark/light theme for the {@link PrinterService}.
 *
 * With the `auto` value the terminal background is detected and dark is used if it cannot be determined.
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
  readonly #detect: () => Promise<boolean | undefined>;

  public constructor(
    executePriority: number,
    detect: () => Promise<boolean | undefined> = () =>
      detectDarkBackground(process.stdin, process.stderr, process.env),
  ) {
    this.executePriority = executePriority;
    this.#detect = detect;
  }

  public async execute(context: Context, argumentValue: SingleValueType): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;

    if (argumentValue === "auto") {
      printerService.darkMode = printerService.colorEnabled
        ? ((await this.#detect()) ?? true)
        : true;
    } else {
      printerService.darkMode = argumentValue === "dark";
    }
  }
}
