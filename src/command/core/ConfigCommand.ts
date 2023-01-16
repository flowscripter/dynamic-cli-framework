import GlobalModifierCommand from "../../api/command/GlobalModifierCommand.ts";
import GlobalCommandArgument from "../../api/argument/GlobalCommandArgument.ts";
import {
  ArgumentValues,
  ArgumentValueTypeName,
} from "../../api/argument/ArgumentValueTypes.ts";
import Context from "../../api/runtime/Context.ts";
import ConfigurationService from "../../service/core/ConfigurationService.ts";

/**
 * Command allowing the specification of the configuration file location used by the {@link ConfigurationService}.
 */
export default class ConfigCommand implements GlobalModifierCommand {
  readonly name = "config";
  readonly description = "Set the configuration file location";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    name: "location",
    type: ArgumentValueTypeName.STRING,
    configurationKey: "CONFIG_LOCATION",
  };
  readonly executePriority: number;

  private readonly configurationService: ConfigurationService;

  public constructor(
    configurationService: ConfigurationService,
    executePriority: number,
  ) {
    this.configurationService = configurationService;
    this.executePriority = executePriority;
  }

  public async execute(
    argumentValues: ArgumentValues,
    _context: Context,
  ): Promise<void> {
    const configLocation = argumentValues[this.argument.name] as string;

    await this.configurationService.setConfigLocation(configLocation);
  }
}
