import process from "node:process";
import path from "node:path";
import fs from "node:fs/promises";
import { Stats } from "node:fs";
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
import DumpConfigCommand from "./command/DumpConfigCommand.ts";
import {
  CONFIGURATION_SERVICE_ID,
  SECRET_SENTINEL_PREFIX,
} from "@flowscripter/dynamic-cli-framework-api";
import type { ConfigurationService } from "@flowscripter/dynamic-cli-framework-api";
import DefaultSecretService from "./DefaultSecretService.ts";
import resolveSecrets from "./resolveSecrets.ts";
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

const logger = getLogger("ConfigurationServiceProvider");

export type KeyValueServiceScopeType = "command" | "service";

class ConfigurationServiceImpl implements ConfigurationService {
  readonly #provider: ConfigurationServiceProvider;

  public constructor(provider: ConfigurationServiceProvider) {
    this.#provider = provider;
  }

  public get configLocation(): string | undefined {
    return this.#provider.configLocation;
  }

  public setConfigLocation(location: string): void {
    this.#provider.setConfigLocation(location);
  }

  public getConfigString(): string {
    return this.#provider.getConfigString();
  }
}

/**
 * Provides configuration of default command arguments using a configuration file and/or
 * environment variables.
 *
 * The same configuration file also backs the raw, per-scope key-value data consumed by
 * {@link KeyValueServiceProvider} (which holds a direct reference to this provider - see
 * {@link getKeyValueData} and {@link flushIfDirty} - rather than looking this provider up via
 * {@link Context}, since only {@link configLocation}/{@link setConfigLocation}/
 * {@link getConfigString} are safe to expose generally).
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
 * A JSON file where the structure matches {@link Values} and the defaults are stored
 * under a top level `defaults` property. The second level of properties is used to refer to {@link Command.name}
 * and the contained values are treated as command {@link Values}. As an example:
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
 *         "globalCommand": "globalArgumentValue"
 *     },
 *     "key-values": {
 *         ...
 *     }
 * }
 * ```
 *
 * The default location of the configuration file is `$HOME/.<application_name>.json`. If `$HOME` is not defined no
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
 * is additionally suffixed with the {@link CLIConfig.name} and the {@link Command.name} with `_` separators.
 * This is best explained with examples...
 *
 * No custom configuration key examples:
 *
 * * executable: `MyCLI`, command: `globalCommand1`, global command argument => environment variable: `MYCLI_GLOBALCOMMAND1`
 * * executable: `MyCLI`, command: `command1`, simple root argument: `arg1` => environment variable: `MYCLI_COMMAND1_ARG1`
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

  // the location of the currently managed configuration data
  public configLocation: string | undefined;

  // the configuration data to be used by the CLI runner implementation when setting command defaults.
  // SingleValueType is for GlobalCommandArgument values, Values is for
  // SubCommandArgument values.
  public defaultsData: Map<string, Values | SingleValueType> = new Map();

  // the underlying per-scope key-value data, read from/written to the configuration file. Exposed
  // (raw, not wrapped in a KeyValueService) only via getKeyValueData(), for KeyValueServiceProvider's
  // exclusive use.
  #commandKeyValueData = new Map<string, Map<string, ValueNode>>();
  #serviceKeyValueData = new Map<string, Map<string, ValueNode>>();

  // secret service used only to resolve secret sentinels embedded in default command argument
  // values (getDefaultArgumentValues()) - unrelated to per-command/per-service KV scoping, so it
  // uses its own fixed, dedicated scope prefix ("defaults"). Its scope is otherwise irrelevant,
  // since only getSecret() (which doesn't consult scope) is ever called on it.
  #defaultsSecretService: DefaultSecretService | undefined;

  /**
   * A {@link ConfigurationService} view of this provider, registered in the {@link Context} under
   * {@link CONFIGURATION_SERVICE_ID}. Its `configLocation` getter always reflects this provider's
   * current value.
   */
  readonly #configurationService: ConfigurationService;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   * @param envVarsEnabled optionally support checking env variables for default argument values.
   * @param configEnabled optionally enable configuration file support for default argument values.
   * @param secretServiceEnabled optionally enable OS-native secret storage via Bun.secrets for resolving
   * secrets embedded in default argument values: `configEnabled` must be true in this case
   */
  public constructor(
    servicePriority: number,
    envVarsEnabled = false,
    configEnabled = false,
    secretServiceEnabled = false,
  ) {
    if (!configEnabled && secretServiceEnabled) {
      throw new Error("configEnabled must be true if secretServiceEnabled is true");
    }
    this.servicePriority = servicePriority;
    this.envVarsEnabled = envVarsEnabled;
    this.configEnabled = configEnabled;
    this.secretServiceEnabled = secretServiceEnabled;

    this.#configurationService = new ConfigurationServiceImpl(this);
  }

  public getServiceInfo(cliConfig: CLIConfig): Promise<ServiceInfo> {
    const commands: Array<Command> = [];

    if (this.configEnabled) {
      commands.push(new ConfigCommand(this.servicePriority));
      commands.push(new DumpConfigCommand());
    }
    if (this.secretServiceEnabled) {
      this.#defaultsSecretService = new DefaultSecretService(cliConfig.name, "defaults");
    }
    return Promise.resolve({
      service: this.#configurationService,
      // this may be empty if configEnabled is false
      commands,
    });
  }

  public setConfigLocation(configLocation: string) {
    this.configLocation = configLocation;
  }

  /**
   * Retrieve the default command argument values (if any) for the provided {@link Command}.
   *
   * This will retrieve values both from the configuration location and environment variables.
   *
   * @param cliConfig the {@link CLIConfig} to use for retrieving configuration keys.
   * @param command the {@link Command} instance to retrieve default argument values for.
   */
  public async getDefaultArgumentValues(
    cliConfig: CLIConfig,
    command: Command,
  ): Promise<PopulatedValues | PopulatedValueType | undefined> {
    if (!this.configEnabled) {
      logger.debug("configuration of default values is not enabled");
      return undefined;
    }

    logger.debug("getting default argument values for command: %s", command.name);

    if (command.enableConfiguration === undefined || command.enableConfiguration !== true) {
      logger.debug("enableConfiguration for command: %s is not true", command.name);
      return undefined;
    }

    let result: PopulatedValues | PopulatedValueType | undefined;

    if (isGlobalModifierCommand(command) || isGlobalCommand(command)) {
      const configuredValue = this.defaultsData.get(command.name) as SingleValueType;
      const envVarValue = this.envVarsEnabled
        ? getGlobalCommandValueFromEnvVars(cliConfig, command)
        : undefined;
      // default to environment variable value
      result = envVarValue !== undefined ? envVarValue : configuredValue;
    } else if (isSubCommand(command)) {
      const configuredValues = this.defaultsData.get(command.name) as Values;
      const envVarValues = this.envVarsEnabled
        ? getSubCommandValuesFromEnvVars(cliConfig, command)
        : undefined;
      if (envVarValues === undefined) {
        result = configuredValues;
      } else if (configuredValues === undefined) {
        result = envVarValues;
      } else {
        result = argumentValueMerge(envVarValues, configuredValues) as PopulatedValues;
      }
    }

    if (result !== undefined && this.#defaultsSecretService) {
      result = await resolveSecrets<PopulatedValues | PopulatedValueType>(
        result,
        async (bunSecretName) => {
          const secretValue = await this.#defaultsSecretService!.getSecret(bunSecretName);
          if (secretValue === null) {
            throw new Error(
              `Secret not found in OS secret store for sentinel: '${SECRET_SENTINEL_PREFIX}${bunSecretName}'`,
            );
          }
          return secretValue;
        },
      );
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
    const keyValueData =
      scopeType === "command" ? this.#commandKeyValueData : this.#serviceKeyValueData;
    if (!keyValueData.has(scopeKey)) {
      keyValueData.set(scopeKey, new Map());
    }
    return keyValueData.get(scopeKey)!;
  }

  /**
   * Write the configuration file, if `isDirty` is true - for {@link KeyValueServiceProvider}'s
   * exclusive use, via its direct reference to this provider, called from its shutdown-time
   * flush task.
   *
   * @param isDirty whether any scoped KeyValueService has unwritten changes.
   */
  public async flushIfDirty(isDirty: boolean): Promise<void> {
    if (!isDirty) {
      return;
    }
    if (this.configLocation === undefined) {
      throw new Error("Attempt to write updated config with no configLocation set");
    }
    await this.#writeConfig(this.configLocation);
  }

  public async initService(context: Context): Promise<void> {
    if (!this.configEnabled) {
      return;
    }

    let isDefault = false;
    if (this.configLocation === undefined) {
      isDefault = true;
      // default to `$HOME/.<application_name>.json`
      const home = process.env["HOME"];
      if (home) {
        this.configLocation = path.join(home, `.${context.cliConfig.name.replace(/\W/g, "")}.json`);
      }
    }
    if (this.configLocation === undefined) {
      return;
    }
    let fileInfo: Stats;
    try {
      fileInfo = await fs.lstat(this.configLocation);
    } catch (err) {
      const error = err as Error;
      if (isDefault) {
        logger.debug(
          "Default config file location: %s does not exist or is not visible - ignoring: %s",
          this.configLocation,
          error.message,
        );
        return;
      } else {
        throw new Error(
          `Config file location: '${this.configLocation}' doesn't exist or not visible: ${error.message}`,
        );
      }
    }
    if (fileInfo.isDirectory()) {
      throw new Error(
        `Config file location: '${this.configLocation}' is a directory and not a file!`,
      );
    }

    await this.#readConfig(this.configLocation);
  }

  async #readConfig(location: string): Promise<void> {
    try {
      logger.debug("Reading config from: %s", location);

      const data = await fs.readFile(location);
      const config = JSON.parse(data.toString());

      if (config === undefined) {
        return;
      }
      this.defaultsData.clear();
      this.#commandKeyValueData.clear();
      this.#serviceKeyValueData.clear();
      if (config.defaults !== undefined) {
        const defaults = config.defaults;
        Object.keys(defaults).forEach((commandName) => {
          this.defaultsData.set(commandName, defaults[commandName] as Values);
          logger.debug("Set default argument values for command name: %s", commandName);
        });
      }
      if (config["key-values"] !== undefined) {
        const keyValues = config["key-values"];
        if (keyValues.commands !== undefined) {
          const commandKeyValues = keyValues.commands;
          Object.keys(commandKeyValues).forEach((commandName) => {
            this.#commandKeyValueData.set(
              commandName,
              new Map(Object.entries(commandKeyValues[commandName])),
            );
            logger.debug("Set default argument values for command name: %s", commandName);
          });
        }
        if (keyValues.services !== undefined) {
          const serviceKeyValues = keyValues.services;
          Object.keys(serviceKeyValues).forEach((serviceId) => {
            this.#serviceKeyValueData.set(
              serviceId,
              new Map(Object.entries(serviceKeyValues[serviceId])),
            );
            logger.debug("Set default argument values for service ID: %s", serviceId);
          });
        }
      }
    } catch (err) {
      throw new Error(`Failed to read config at location: '${this.configLocation}': ${err}`);
    }
  }

  async #writeConfig(location: string): Promise<void> {
    logger.debug("Writing config to: %s", location);

    try {
      await fs.writeFile(location, this.getConfigString());
    } catch (err) {
      throw new Error(`Failed to write config at location: '${this.configLocation}': ${err}`);
    }
  }

  public getConfigString(): string {
    const config: {
      defaults?: Record<string, Values | SingleValueType>;
      "key-values"?: {
        commands?: Record<string, Record<string, ValueNode>>;
        services?: Record<string, Record<string, ValueNode>>;
      };
    } = {};

    if (this.defaultsData.size > 0) {
      config.defaults = Object.fromEntries(this.defaultsData);
    }
    if (this.#commandKeyValueData.size > 0 || this.#serviceKeyValueData.size > 0) {
      config["key-values"] = {};
      if (this.#commandKeyValueData.size > 0) {
        config["key-values"].commands = {};
        for (const [commandName, keyValueData] of this.#commandKeyValueData.entries()) {
          if (keyValueData.size > 0) {
            config["key-values"].commands[commandName] = Object.fromEntries(keyValueData);
          }
        }
      }
      if (this.#serviceKeyValueData.size > 0) {
        config["key-values"].services = {};
        for (const [serviceId, keyValueData] of this.#serviceKeyValueData.entries()) {
          if (keyValueData.size > 0) {
            config["key-values"].services[serviceId] = Object.fromEntries(keyValueData);
          }
        }
      }
    }
    return JSON.stringify(config, null, 2);
  }
}
