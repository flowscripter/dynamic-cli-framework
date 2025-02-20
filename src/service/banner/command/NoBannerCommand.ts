import type GlobalModifierCommand from "../../../api/command/GlobalModifierCommand.ts";
import {
  type ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "../../../api/argument/ArgumentValueTypes.ts";
import type Context from "../../../api/Context.ts";
import type GlobalCommandArgument from "../../../api/argument/GlobalCommandArgument.ts";
import type BannerServiceProvider from "../BannerServiceProvider.ts";

/**
 * Command to disable banner output for the CLI application.
 */
export default class NoBannerCommand implements GlobalModifierCommand {
  readonly name = "no-banner";
  readonly description = "Disable output of banner";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ArgumentValueTypeName.BOOLEAN,
    defaultValue: true,
    configurationKey: "NO_BANNER",
  };
  readonly executePriority: number;

  readonly #bannerServiceProvider: BannerServiceProvider;

  public constructor(
    bannerServiceProvider: BannerServiceProvider,
    executePriority: number,
  ) {
    this.#bannerServiceProvider = bannerServiceProvider;
    this.executePriority = executePriority;
  }

  public execute(
    _context: Context,
    argumentValue: ArgumentSingleValueType,
  ): Promise<void> {
    this.#bannerServiceProvider.printBanner = !(argumentValue as boolean);

    return Promise.resolve();
  }
}
