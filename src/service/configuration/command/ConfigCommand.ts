import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
import {
  type ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type ConfigurationServiceProvider from "../ConfigurationServiceProvider.ts";

/**
 * Command allowing the specification of the configuration file location used by the {@link ConfigurationServiceProvider}.
 */
export default class ConfigCommand implements GlobalModifierCommand {
  readonly name = "config";
  readonly description = "Set the configuration file location";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ArgumentValueTypeName.STRING,
    configurationKey: "CONFIG",
  };
  readonly executePriority: number;

  readonly #configurationServiceProvider: ConfigurationServiceProvider;

  public constructor(
    configurationServiceProvider: ConfigurationServiceProvider,
    executePriority: number,
  ) {
    this.#configurationServiceProvider = configurationServiceProvider;
    this.executePriority = executePriority;
  }

  public execute(_context: Context, argumentValue: ArgumentSingleValueType): Promise<void> {
    const configLocation = argumentValue as string;

    this.#configurationServiceProvider.setConfigLocation(configLocation);

    return Promise.resolve();
  }
}
