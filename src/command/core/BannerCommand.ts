import GlobalModifierCommand from "../../api/command/GlobalModifierCommand.ts";
import {
  ArgumentValues,
  ArgumentValueTypeName,
} from "../../api/argument/ArgumentValueTypes.ts";
import Context from "../../api/Context.ts";
import Printer, {
  AsciiBannerFont,
  PRINTER_SERVICE_ID,
} from "../../api/service/core/Printer.ts";
import GlobalCommandArgument from "../../api/argument/GlobalCommandArgument.ts";
import Configuration, {
  CONFIGURATION_SERVICE_ID,
} from "../../api/service/core/Configuration.ts";

/**
 * Command to output a banner for the CLI application.
 */
export default class BannerCommand implements GlobalModifierCommand {
  readonly name = "print-banner";
  readonly description = "Print a CLI banner";
  readonly argument: GlobalCommandArgument = {
    name: "font",
    type: ArgumentValueTypeName.STRING,
    defaultValue: AsciiBannerFont.STANDARD,
    allowableValues: Object.values(AsciiBannerFont),
  };
  readonly executePriority: number;

  /**
   * Whether or not to actually print the banner. This allows the {@link NoBanner} command to prevent output
   * of the banner.
   */
  printBanner = true;

  public constructor(
    executePriority: number,
  ) {
    this.executePriority = executePriority;
  }

  public async execute(
    argumentValues: ArgumentValues,
    context: Context,
  ): Promise<void> {
    if (!this.printBanner) {
      return;
    }

    const printer = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as Printer;
    const configuration = context.getServiceById(
      CONFIGURATION_SERVICE_ID,
    ) as Configuration;

    const { cliConfig } = context;
    const font = argumentValues[this.argument.name] as string;

    const bannerText = await printer.asciiBanner(
      cliConfig.name.toUpperCase(),
      font as AsciiBannerFont,
    );

    await printer.print(printer.blue(bannerText));
    if (cliConfig.description !== undefined) {
      await printer.print(`  ${printer.primary(cliConfig.description)}\n`);
    }
    if (cliConfig.version.length > 0) {
      await printer.print(
        `  ${printer.secondary("version: " + cliConfig.version)}\n`,
      );
    }
    if (configuration.getConfigLocation().length > 0) {
      await printer.print(
        `  ${
          printer.secondary("config: " + configuration.getConfigLocation())
        }\n`,
      );
    }
    await printer.print("\n");
  }
}
