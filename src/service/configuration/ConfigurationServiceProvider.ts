import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import ConfigCommand from "./command/ConfigCommand.ts";
import type {
  SingleValueType,
  Values,
  ValueNode,
  PopulatedValues,
  PopulatedValueType,
} from "@flowscripter/dynamic-cli-framework-api";
import getLogger from "../../util/logger.ts";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommand, GroupCommand } from "@flowscripter/dynamic-cli-framework-api";
import ConfigDumpSubCommand from "./command/ConfigDumpSubCommand.ts";
import ConfigGroupCommand from "./command/ConfigGroupCommand.ts";
import ConfigGetSubCommand from "./command/ConfigGetSubCommand.ts";
import ConfigSetSubCommand from "./command/ConfigSetSubCommand.ts";
import ConfigUnsetSubCommand from "./command/ConfigUnsetSubCommand.ts";
import type { CommandRegistry } from "@flowscripter/dynamic-cli-framework-api";
import {
  CONFIGURATION_SERVICE_ID,
  type ConfigurationService,
} from "@flowscripter/dynamic-cli-framework-api";
import DefaultConfigurationService, {
  type KeyValueServiceScopeType,
} from "./DefaultConfigurationService.ts";
import DefaultSecretService, { type SecretsApi } from "./DefaultSecretService.ts";
import type ConfigFormat from "./format/ConfigFormat.ts";
import jsonFormat from "./format/JsonConfigFormat.ts";
import type { Command } from "@flowscripter/dynamic-cli-framework-api";
import argumentValueMerge from "../../runtime/values/argumentValueMerge.ts";
import {
  isGlobalCommand,
  isGlobalModifierCommand,
  isSubCommand,
} from "../../runtime/command/CommandTypeGuards.ts";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import {
  getGlobalCommandValueFromEnvVars,
  getSubCommandValuesFromEnvVars,
} from "../../util/envVarHelper.ts";

export type { KeyValueServiceScopeType };

const logger = getLogger("ConfigurationServiceProvider");

/**
 * The only view of the configuration which is registered in the {@link Context}, and therefore reachable by
 * every command and service. It deliberately exposes nothing but the config file location: the
 * {@link DefaultConfigurationService} (default values, per-scope key-value data, secret resolution and
 * persistence) is only handed to the `config` group commands and {@link KeyValueServiceProvider}.
 */
class ConfigurationLocationService implements ConfigurationService {
  readonly #service: DefaultConfigurationService;

  public constructor(service: DefaultConfigurationService) {
    this.#service = service;
  }

  public get configLocation(): string | undefined {
    return this.#service.configLocation;
  }

  public setConfigLocation(location: string): void {
    this.#service.setConfigLocation(location);
  }
}

/**
 * Provides configuration of default command arguments using a configuration file and/or
 * environment variables.
 *
 * The same configuration file also backs the raw, per-scope key-value data consumed by
 * {@link KeyValueServiceProvider} (which holds a direct reference to this provider - see
 * {@link getKeyValueData} and {@link flushIfDirty}). The configuration data and its persistence are
 * owned by {@link DefaultConfigurationService}, which is passed directly to the `config` group commands. Only a
 * view exposing the config file location is registered under {@link CONFIGURATION_SERVICE_ID}.
 *
 * **Default Command Arguments**
 *
 * Configuration of default {@link Values} for {@link Command} instances is supported if they
 * have defined {@link Command.enableConfiguration} as `true`.
 *
 * Two sources of configuration are supported and both are expected to be manually managed by the user of the CLI.
 *
 * *Configuration File*
 *
 * A file (JSON by default, see {@link ConfigFormat}) where the structure matches {@link Values} and the defaults are stored
 * under a top level `defaults` property. The second level of properties is used to refer to {@link Command.name}
 * (or `<group name>:<member name>` for a member of a {@link GroupCommand}) and the contained values are treated as
 * command {@link Values}. As an example:
 *
 * ```
 * {
 *     "defaults": {
 *         "subCommand1": {
 *             "arg1": [
 *                 1,
 *                 2
 *             ],
 *             "arg2": {
 *                 "arg3": "foo"
 *             }
 *         },
 *         "command2": {
 *             "arg4": true
 *         },
 *         "group1:member1": {
 *             "arg5": "bar"
 *         },
 *         "globalCommand": "globalArgumentValue"
 *     },
 *     "key-values": {
 *         ...
 *     }
 * }
 * ```
 *
 * The syntax of the file is set by the `configFormat` constructor argument: JSON (the default), or YAML or TOML
 * from the `yaml` and `toml` entry points of this package. The format is never inferred from the file name or
 * extension and existing files are not migrated between formats. For YAML and TOML, comments and layout in the
 * existing file are preserved when it is written back.
 *
 * The default location of the configuration file is `$HOME/.<application_name>.<format extension>`. If `$HOME` is not defined no
 * default configuration will be used. The location of the configuration file can be modified via the
 * {@link ConfigCommand}.
 *
 * NOTE: You may store default arguments for secrets by manually configuring secrets in your OS
 * credential store and referencing them in the config file using the sentinel format
 * `__SECRET__:<bun_secret_name>`. These values will be resolved from the OS secret store
 * before being returned as default argument values. See {@link KeyValueServiceProvider} for the
 * generic key-value store which uses the same secret sentinel mechanism.
 *
 * *Environment Variables*
 *
 * Values are parsed using a key path defined by custom {@link Argument.configurationKey}
 * values or using the default naming scheme defined within {@link Argument.configurationKey}.
 *
 * NOTE: Any values set by environment variables will override those sourced from the configuration file.
 *
 * The argument key path is derived for an argument (or nested argument) as follows:
 *
 * Argument configuration keys are concatenated with a `_` separator.
 * Any arguments which support array values must by suffixed with `_` and an explicit array index.
 * If the root argument in the path does not use a custom {@link Argument.configurationKey} then the key path
 * is additionally prefixed with the {@link CLIConfig.name}, the {@link GroupCommand.name} (if the command is a group
 * member) and the {@link Command.name} with `_` separators.
 * This is best explained with examples...
 *
 * No custom configuration key examples:
 *
 * * executable: `MyCLI`, command: `globalCommand1`, global command argument => environment variable: `MYCLI_GLOBALCOMMAND1`
 * * executable: `MyCLI`, command: `command1`, simple root argument: `arg1` => environment variable: `MYCLI_COMMAND1_ARG1`
 * * executable: `MyCLI`, group: `group1`, member command: `member1`, simple root argument: `arg1` => environment variable: `MYCLI_GROUP1_MEMBER1_ARG1`
 * * executable: `MyCLI`, command: `command1`, array root argument, 1st element: `arg2[0]` => environment variable: `MYCLI_COMMAND1_ARG2_0`
 * * executable: `MyCLI`, command: `command1`, argument is a digit so it is by default suffixed with `_`: `3` => environment variable: `MYCLI_COMMAND1__3`
 * * executable: `MyCLI`, command: `command1`, nested sub-argument: `arg1.arg2` => environment variable: `MYCLI_COMMAND1_ARG1_ARG2`
 * * executable: `MyCLI`, command: `command1`, nested sub-argument with both levels being arrays and referring to the 2nd element of each: `arg1[1].arg2[1]` => environment variable: `MYCLI_COMMAND1_ARG1_1_ARG2_2`
 *
 * Custom configuration key at the root level (and therefore not prefixed with CLI and command names) examples:
 *
 * * executable: `MyCLI`, command: `globalCommand1`, global command argument`, global command argument configuration key: `FOO` => environment variable: `FOO`
 * * executable: `MyCLI`, command: `command1`, simple root argument: `arg1`, arg1 configuration key: `FOO` => environment variable: `FOO`
 * * executable: `MyCLI`, command: `command1`, array root argument, 1st element: `arg2[0]`, arg1 configuration key: `BAR` => environment variable: `BAR_0`
 *
 * Custom configuration key not at the root level (and therefore prefixed with CLI and command names) examples:
 *
 * * executable: `MyCLI`, command: `command1`, nested sub-argument: `arg1.arg2`, arg2 configuration key: `FOO` => environment variable: `MYCLI_COMMAND1_ARG1_FOO`
 * * executable: `MyCLI`, command: `command1`, nested sub-argument with both levels being arrays and referring to the 2nd element of each: `arg1[1].arg2[1]`, arg2 configuration key: `BAR` => environment variable: `MYCLI_COMMAND1_ARG1_1_BAR_2`
 *
 * NOTE: Any default values from the above configuration sources will be overridden by any arguments provided on the command line.
 */
export default class ConfigurationServiceProvider implements ServiceProvider {
  readonly serviceId: string = CONFIGURATION_SERVICE_ID;
  readonly servicePriority: number;

  public readonly envVarsEnabled: boolean;
  public readonly configEnabled: boolean;
  public readonly secretServiceEnabled: boolean;
  public readonly configFormat: ConfigFormat;

  /**
   * The {@link DefaultConfigurationService} which owns the configuration data. It is never registered
   * in the {@link Context}: it is handed directly to the `config` group commands only.
   */
  readonly #configurationService: DefaultConfigurationService;

  readonly #hasCommandRegistry: boolean;

  readonly #secretsApi: SecretsApi | undefined;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   * @param envVarsEnabled optionally support checking env variables for default argument values.
   * @param configEnabled optionally enable configuration file support for default argument values.
   * @param secretServiceEnabled optionally enable OS-native secret storage via Bun.secrets for resolving
   * secrets embedded in default argument values: `configEnabled` must be true in this case
   * @param configFormat optionally set the syntax of the configuration file, defaults to JSON.
   * @param commandRegistry optionally provide the registry of all commands, required for the `config:get`,
   * `config:set` and `config:unset` commands to be provided.
   * @param secretsApi optionally override the OS secret store used for storing SECRET default values.
   */
  public constructor(
    servicePriority: number,
    envVarsEnabled = false,
    configEnabled = false,
    secretServiceEnabled = false,
    configFormat: ConfigFormat = jsonFormat,
    commandRegistry?: CommandRegistry,
    secretsApi?: SecretsApi,
  ) {
    if (!configEnabled && secretServiceEnabled) {
      throw new Error("configEnabled must be true if secretServiceEnabled is true");
    }
    this.servicePriority = servicePriority;
    this.envVarsEnabled = envVarsEnabled;
    this.configEnabled = configEnabled;
    this.secretServiceEnabled = secretServiceEnabled;
    this.configFormat = configFormat;
    this.#hasCommandRegistry = commandRegistry !== undefined;
    this.#secretsApi = secretsApi;

    this.#configurationService = new DefaultConfigurationService(
      envVarsEnabled,
      configFormat,
      commandRegistry,
    );
  }

  public getServiceInfo(cliConfig: CLIConfig): Promise<ServiceInfo> {
    const commands: Array<Command> = [];

    if (this.configEnabled) {
      commands.push(new ConfigCommand(this.servicePriority));
      const members: Array<SubCommand> = [new ConfigDumpSubCommand(this.#configurationService)];
      if (this.#hasCommandRegistry) {
        members.push(
          new ConfigGetSubCommand(this.#configurationService),
          new ConfigSetSubCommand(this.#configurationService),
          new ConfigUnsetSubCommand(this.#configurationService),
        );
      }
      commands.push(new ConfigGroupCommand(members));
    }
    if (this.secretServiceEnabled) {
      this.#configurationService.setDefaultsSecretService(
        new DefaultSecretService(cliConfig.name, "defaults", this.#secretsApi),
      );
    }
    return Promise.resolve({
      service: new ConfigurationLocationService(this.#configurationService),
      // this may be empty if configEnabled is false
      commands,
    });
  }

  /**
   * The {@link DefaultConfigurationService} which owns the configuration data, for trusted wiring and tests.
   */
  public get configurationService(): DefaultConfigurationService {
    return this.#configurationService;
  }

  public get configLocation(): string | undefined {
    return this.#configurationService.configLocation;
  }

  public set configLocation(location: string | undefined) {
    this.#configurationService.configLocation = location;
  }

  public get defaultsData(): Map<string, Values | SingleValueType> {
    return this.#configurationService.defaultsData;
  }

  public set defaultsData(data: Map<string, Values | SingleValueType>) {
    this.#configurationService.defaultsData = data;
  }

  public setConfigLocation(configLocation: string) {
    this.#configurationService.setConfigLocation(configLocation);
  }

  /**
   * Retrieve the default command argument values (if any) for the provided {@link Command}.
   *
   * This will retrieve values both from the configuration location and environment variables.
   *
   * @param cliConfig the {@link CLIConfig} to use for retrieving configuration keys.
   * @param command the {@link Command} instance to retrieve default argument values for.
   * @param groupCommand the {@link GroupCommand} if the command is a group member. The configuration file key
   * is then `<group name>:<command name>` and the env var names include the group name.
   */
  public async getDefaultArgumentValues(
    cliConfig: CLIConfig,
    command: Command,
    groupCommand?: GroupCommand,
  ): Promise<PopulatedValues | PopulatedValueType | undefined> {
    if (!this.configEnabled) {
      logger.debug("configuration of default values is not enabled");
      return undefined;
    }

    const commandKey = groupCommand ? `${groupCommand.name}:${command.name}` : command.name;

    logger.debug("getting default argument values for command: %s", commandKey);

    if (command.enableConfiguration === undefined || command.enableConfiguration !== true) {
      logger.debug("enableConfiguration for command: %s is not true", command.name);
      return undefined;
    }

    let result: PopulatedValues | PopulatedValueType | undefined;

    if (isGlobalModifierCommand(command) || isGlobalCommand(command)) {
      const configuredValue = this.defaultsData.get(commandKey) as SingleValueType;
      const envVarValue = this.envVarsEnabled
        ? getGlobalCommandValueFromEnvVars(cliConfig, command)
        : undefined;
      // default to environment variable value
      result = envVarValue !== undefined ? envVarValue : configuredValue;
    } else if (isSubCommand(command)) {
      const configuredValues = this.defaultsData.get(commandKey) as Values;
      const envVarValues = this.envVarsEnabled
        ? getSubCommandValuesFromEnvVars(cliConfig, command, groupCommand)
        : undefined;
      if (envVarValues === undefined) {
        result = configuredValues;
      } else if (configuredValues === undefined) {
        result = envVarValues;
      } else {
        result = argumentValueMerge(envVarValues, configuredValues) as PopulatedValues;
      }
    }

    if (result !== undefined) {
      result = await this.#configurationService.resolveDefaultSecrets(result);
    }

    return result;
  }

  /**
   * Get-or-create the underlying, raw {@link ValueNode} `Map` for the given scope - for
   * {@link KeyValueServiceProvider}'s exclusive use, via its direct reference to this provider.
   *
   * @param scopeType whether `scopeKey` is a command name or a service/task ID.
   * @param scopeKey the command name or service/task ID to scope the key-value data to.
   */
  public getKeyValueData(
    scopeType: KeyValueServiceScopeType,
    scopeKey: string,
  ): Map<string, ValueNode> {
    return this.#configurationService.getKeyValueData(scopeType, scopeKey);
  }

  /**
   * Write the configuration file, if `isDirty` is true - for {@link KeyValueServiceProvider}'s
   * exclusive use, via its direct reference to this provider, called from its shutdown-time
   * flush task.
   *
   * @param isDirty whether any scoped KeyValueService has unwritten changes.
   */
  public flushIfDirty(isDirty: boolean): Promise<void> {
    return this.#configurationService.flushIfDirty(isDirty);
  }

  public async initService(context: Context): Promise<void> {
    if (!this.configEnabled) {
      return;
    }
    await this.#configurationService.init(context.cliConfig.name);
  }

  public getConfigString(): string {
    return this.#configurationService.getConfigString();
  }
}
