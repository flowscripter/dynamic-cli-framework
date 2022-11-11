import CLIConfig from "./api/CLIConfig.ts";
import {
  ArgumentSingleValueType,
  ArgumentValues,
} from "./api/argument/ArgumentValueTypes.ts";

/**
 * Default implementation of a {@link CLIConfig}.
 */
export default class DefaultCLIConfig implements CLIConfig {
  private readonly defaultArgumentValuesBySubCommandName: Map<
    string,
    ArgumentValues
  >;
  private readonly defaultArgumentValueByGlobalCommandName: Map<
    string,
    ArgumentSingleValueType
  >;

  readonly name: string;
  readonly description: string;
  readonly version: string;

  public constructor(
    name: string,
    description: string,
    version: string,
    defaultArgumentValuesBySubCommandName = new Map<string, ArgumentValues>(),
    defaultArgumentValueByGlobalCommandName = new Map<
      string,
      ArgumentSingleValueType
    >(),
  ) {
    this.name = name;
    this.description = description;
    this.version = version;
    this.defaultArgumentValuesBySubCommandName =
      defaultArgumentValuesBySubCommandName;
    this.defaultArgumentValueByGlobalCommandName =
      defaultArgumentValueByGlobalCommandName;
  }
  public getDefaultArgumentValuesForSubCommand(
    subCommandName: string,
  ): ArgumentValues | undefined {
    return this.defaultArgumentValuesBySubCommandName.get(subCommandName);
  }

  public getDefaultArgumentValueForGlobalCommand(
    globalCommandName: string,
  ): ArgumentSingleValueType | undefined {
    return this.defaultArgumentValueByGlobalCommandName.get(globalCommandName);
  }
}
