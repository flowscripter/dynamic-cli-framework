import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
import { type SingleValueType, ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import {
  CONFIGURATION_SERVICE_ID,
  type ConfigurationService,
} from "@flowscripter/dynamic-cli-framework-api";

/**
 * Command allowing the specification of the configuration file location used by
 * {@link ConfigurationServiceProvider}.
 */
export default class ConfigCommand implements GlobalModifierCommand {
  readonly name = "config";
  readonly description = "Set the configuration file location";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ValueTypeName.STRING,
    configurationKey: "CONFIG",
  };
  readonly executePriority: number;

  public constructor(executePriority: number) {
    this.executePriority = executePriority;
  }

  public execute(context: Context, argumentValue: SingleValueType): Promise<void> {
    const configLocation = argumentValue as string;

    const configurationService = context.getServiceById(
      CONFIGURATION_SERVICE_ID,
    ) as ConfigurationService;
    configurationService.setConfigLocation(configLocation);

    return Promise.resolve();
  }
}
