import GlobalModifierCommand from "../../api/command/GlobalModifierCommand.ts";
import {
  ArgumentValues,
  ArgumentValueTypeName,
} from "../../api/argument/ArgumentValueTypes.ts";
import Context from "../../api/runtime/Context.ts";
import GlobalCommandArgument from "../../api/argument/GlobalCommandArgument.ts";
import BannerCommand from "./BannerCommand.ts";

/**
 * Command to disable banner output for the CLI application.
 */
export default class NoBannerCommand implements GlobalModifierCommand {
  readonly name = "no-banner";
  readonly description = "Disable output of banner";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    name: "no-banner",
    type: ArgumentValueTypeName.BOOLEAN,
    defaultValue: true,
    configurationKey: "NO_BANNER",
  };
  readonly executePriority: number;

  /**
   * Reference to the banner command so that it can be disabled.
   */
  bannerCommand: BannerCommand;

  public constructor(
    bannerCommand: BannerCommand,
    executePriority: number,
  ) {
    this.bannerCommand = bannerCommand;
    this.executePriority = executePriority;
  }

  public execute(
    argumentValues: ArgumentValues,
    _context: Context,
  ): Promise<void> {
    this.bannerCommand.printBanner =
      !argumentValues[this.argument.name] as boolean;

    return Promise.resolve();
  }
}
