import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import { type SingleValueType, ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Task-local, mutable state shared between {@link NoBannerCommand} and the banner
 * {@link StartupTask}'s `run()`, in place of a held `BannerServiceProvider` reference.
 */
export interface BannerState {
  printBanner: boolean;
}

/**
 * Command to disable banner output for the CLI application.
 */
export default class NoBannerCommand implements GlobalModifierCommand {
  readonly name = "no-banner";
  readonly description = "Disable output of banner";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ValueTypeName.BOOLEAN,
    defaultValue: true,
    configurationKey: "NO_BANNER",
  };
  readonly executePriority: number;

  readonly #state: BannerState;

  public constructor(state: BannerState, executePriority: number) {
    this.#state = state;
    this.executePriority = executePriority;
  }

  public execute(_context: Context, argumentValue: SingleValueType): Promise<void> {
    this.#state.printBanner = !(argumentValue as boolean);

    return Promise.resolve();
  }
}
