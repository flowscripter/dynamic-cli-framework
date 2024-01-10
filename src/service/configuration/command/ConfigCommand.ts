import GlobalModifierCommand from "../../../api/command/GlobalModifierCommand.ts";
import GlobalCommandArgument from "../../../api/argument/GlobalCommandArgument.ts";
import {
  ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "../../../api/argument/ArgumentValueTypes.ts";
import Context from "../../../api/Context.ts";
import ConfigurationServiceProvider from "../ConfigurationServiceProvider.ts";

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

  private readonly configurationServiceProvider: ConfigurationServiceProvider;

  public constructor(
    configurationServiceProvider: ConfigurationServiceProvider,
    executePriority: number,
  ) {
    this.configurationServiceProvider = configurationServiceProvider;
    this.executePriority = executePriority;
  }

  public async execute(
    _context: Context,
    argumentValue: ArgumentSingleValueType,
  ): Promise<void> {
    const configLocation = argumentValue as string;

    await this.configurationServiceProvider.setConfigLocation(configLocation);
  }
}
