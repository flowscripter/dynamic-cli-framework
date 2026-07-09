import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import {
  type ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
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

  public constructor(bannerServiceProvider: BannerServiceProvider, executePriority: number) {
    this.#bannerServiceProvider = bannerServiceProvider;
    this.executePriority = executePriority;
  }

  public execute(_context: Context, argumentValue: ArgumentSingleValueType): Promise<void> {
    this.#bannerServiceProvider.printBanner = !(argumentValue as boolean);

    return Promise.resolve();
  }
}
