import process from "node:process";
import path from "node:path";
import fs from "node:fs/promises";
import { Stats } from "node:fs";
import type {
  ServiceInfo,
  ServiceProvider,
} from "../../api/service/ServiceProvider.ts";
import ConfigCommand from "./command/ConfigCommand.ts";
import type {
  ArgumentSingleValueType,
  ArgumentValues,
  PopulatedArgumentValues,
  PopulatedArgumentValueType,
} from "../../api/argument/ArgumentValueTypes.ts";
import getLogger from "../../util/logger.ts";
import type Context from "../../api/Context.ts";
import DumpConfigCommand from "./command/DumpConfigCommand.ts";
import { KEY_VALUE_SERVICE_ID } from "../../api/service/core/KeyValueService.ts";
import DefaultKeyValueService from "./DefaultKeyValueService.ts";
import type Command from "../../api/command/Command.ts";
import argumentValueMerge from "../../runtime/values/argumentValueMerge.ts";
import {
  isGlobalCommand,
  isGlobalModifierCommand,
  isSubCommand,
} from "../../runtime/command/CommandTypeGuards.ts";
import type CLIConfig from "../../api/CLIConfig.ts";
import {
  getGlobalCommandValueFromEnvVars,
  getSubCommandValuesFromEnvVars,
} from "../../util/envVarHelper.ts";

const logger = getLogger("ConfigurationServiceProvider");

/**
 * Provides:
 *
 * * Configuration of default command arguments using a configuration file and/or environment variables.
 * * A generic key-value store for commands and services ({@link KeyValueService}).
 *
 * **Default Command Arguments**
 *
 * Configuration of default {@link ArgumentValues} for {@link Command} instances is supported if they
 * have defined {@link Command.enableConfiguration} as `true`.
 *
 * Two sources of configuration are supported and both are expected to be manually managed by the user of the CLI.
 *
 * *Configuration File*
 *
 * A JSON file where the structure matches {@link ArgumentValues} and the defaults are stored
 * under a top level `defaults` property. The second level of properties is used to refer to {@link Command.name}
 * and the contained values are treated as command {@link ArgumentValues}. As an example:
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
 *
 * **Generic Key-Value Service**
 *
 * The same configuration file above is used to provide storage for the provided {@link KeyValueService}. The values
 * are stored under a top level `key-values` property. These are not expected to be modified by the user of the CLI.
 *
 * The second and third level of properties is used to scope the key-values to specific command names
 * (via {@link Command.name} values) and specific service IDs (via {@link ServiceInfo.serviceId} values).
 * Both keys and values are string based.
 *
 * As an example:
 * ```
 * {
 *    "defaults": {
 *        ...
 *    },
 *    "key-values": {
 *        "commands": {
 *            "command1": {
 *               "foo1": "bar1",
 *               "foo2": "bar2"
 *            },
 *            "command2": {
 *                "foo1": "bar3"
 *            }
 *        },
 *        "services": {
 *            "service-id-1": {
 *                "foo1": "bar"
 *            }
 *        }
 *    }
 * }
 * ```
 */
export default class ConfigurationServiceProvider implements ServiceProvider {
  readonly serviceId: string = KEY_VALUE_SERVICE_ID;
  readonly servicePriority: number;

  public readonly envVarsEnabled: boolean;
  public readonly configEnabled: boolean;
  public readonly keyValueServiceEnabled: boolean;

  // the location of the currently managed configuration data
  public configLocation: string | undefined;

  // the configuration data to be used by the CLI runner implementation when setting command defaults.
  // ArgumentSingleValueType is for GlobalCommandArgument values, ArgumentValues is for
  // SubCommandArgument values.
  public defaultsData: Map<
    string,
    ArgumentValues | ArgumentSingleValueType
  > = new Map();

  // the configuration data to be used by the CLI runner implementation
  // when updating command scoped access to key-value data via the key-value service.
  #commandKeyValueData = new Map<string, Map<string, string>>();

  // the configuration data to be used by the CLI runner implementation
  // when updating service scoped access to key-value data via the key-value service.
  #serviceKeyValueData = new Map<string, Map<string, string>>();

  // the optional service providing scope limited key-value data to commands and other services
  readonly #defaultKeyValueService: DefaultKeyValueService | undefined;

  #currentCommandNameKeyValueScope: string | undefined;
  #currentServiceIdKeyValueScope: string | undefined;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   * @param envVarsEnabled optionally support checking env variables for default argument values.
   * @param configEnabled optionally enable configuration file support for default argument values.
   * @param keyValueServiceEnabled optionally provide a {@link KeyValueService} implementation: `configEnabled` must be true in this case
   */
  public constructor(
    servicePriority: number,
    envVarsEnabled = false,
    configEnabled = false,
    keyValueServiceEnabled = false,
  ) {
    if (!configEnabled && keyValueServiceEnabled) {
      throw new Error(
        "configEnabled must be true if keyValueServiceEnabled is true",
      );
    }
    this.servicePriority = servicePriority;
    this.envVarsEnabled = envVarsEnabled;
    this.configEnabled = configEnabled;
    this.keyValueServiceEnabled = keyValueServiceEnabled;
    if (keyValueServiceEnabled) {
      this.#defaultKeyValueService = new DefaultKeyValueService();
    }
  }

  public provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    const commands: Array<Command> = [];

    if (this.configEnabled) {
      commands.push(new ConfigCommand(this, this.servicePriority));
      commands.push(new DumpConfigCommand(this));
    }
    return Promise.resolve({
      // this may be undefined if keyValueServiceEnabled is false
      service: this.#defaultKeyValueService,
      // this may be empty if configEnabled is false
      commands,
    });
  }

  public setConfigLocation(configLocation: string) {
    this.configLocation = configLocation;
  }

  /**
   * Retrieve the defaults command argument values (if any) for the provided {@link Command}.
   *
   * This will retrieve values both from the configuration location and environment variables.
   *
   * @param cliConfig the {@link CLIConfig} to use for retrieving configuration keys.
   * @param command the {@link Command} instance to retrieve default argument values for.
   */
  public getDefaultArgumentValues(
    cliConfig: CLIConfig,
    command: Command,
  ): PopulatedArgumentValues | PopulatedArgumentValueType | undefined {
    if (!this.configEnabled) {
      logger.debug(
        "configuration of default values is not enabled",
      );
      return undefined;
    }

    logger.debug(
      "getting default argument values for command: %s",
      command.name,
    );

    if (
      (command.enableConfiguration === undefined) ||
      (command.enableConfiguration !== true)
    ) {
      logger.debug(
        "enableConfiguration for command: %s is not true",
        command.name,
      );
      return undefined;
    }

    if (isGlobalModifierCommand(command) || isGlobalCommand(command)) {
      const configuredValue = this.defaultsData.get(
        command.name,
      ) as ArgumentSingleValueType;
      const envVarValue = this.envVarsEnabled
        ? getGlobalCommandValueFromEnvVars(
          cliConfig,
          command,
        )
        : undefined;
      // default to environment variable value
      if (envVarValue !== undefined) {
        return envVarValue;
      }

      return configuredValue;
    } else if (isSubCommand(command)) {
      const configuredValues = this.defaultsData.get(
        command.name,
      ) as ArgumentValues;
      const envVarValues = this.envVarsEnabled
        ? getSubCommandValuesFromEnvVars(
          cliConfig,
          command,
        )
        : undefined;
      if (envVarValues === undefined) {
        return configuredValues;
      }
      if (configuredValues === undefined) {
        return envVarValues;
      }
      return argumentValueMerge(
        envVarValues,
        configuredValues,
      ) as PopulatedArgumentValues;
    }
  }

  /**
   * Indicate that the contained {@link DefaultKeyValueService} should be set to have a scope of the provided
   * command name.
   *
   * @param commandName the name of the command to scope the key-value data to.
   *
   * @throws {Error} if an existing scope is set.
   */
  public setCommandKeyValueScope(commandName: string): void {
    if (!this.keyValueServiceEnabled) {
      throw new Error(
        `Attempt to use KeyValueService which is not enabled`,
      );
    }
    if (this.#currentCommandNameKeyValueScope) {
      throw new Error(
        `Attempt to set CommandNameKeyValueScope to ${commandName} when it is currently set to ${this.#currentCommandNameKeyValueScope}`,
      );
    }
    if (this.#currentServiceIdKeyValueScope) {
      throw new Error(
        `Attempt to set CommandNameKeyValueScope to ${commandName} when ServiceIdKeyValueScope is currently set to ${this.#currentCommandNameKeyValueScope}`,
      );
    }
    this.#currentCommandNameKeyValueScope = commandName;

    logger.debug("currentCommandNameKeyValueScope: %s", commandName);

    if (!this.#commandKeyValueData.has(commandName)) {
      this.#commandKeyValueData.set(commandName, new Map());
    }
    this.#defaultKeyValueService!.setKeyValueData(
      this.#commandKeyValueData.get(commandName)!,
    );
  }

  /**
   * Indicate that the contained {@link DefaultKeyValueService} should be set to have a scope of the provided
   * service ID.
   *
   * @param serviceId the ID of the service to scope the key-value data to.
   *
   * @throws {Error} if an existing scope is set.
   */
  public setServiceKeyValueScope(serviceId: string): void {
    if (!this.keyValueServiceEnabled) {
      throw new Error(
        `Attempt to use KeyValueService which is not enabled`,
      );
    }
    if (this.#currentServiceIdKeyValueScope) {
      throw new Error(
        `Attempt to set ServiceIdKeyValueScope to ${serviceId} when it is currently set to ${this.#currentServiceIdKeyValueScope}`,
      );
    }
    if (this.#currentCommandNameKeyValueScope) {
      throw new Error(
        `Attempt to set ServiceIdKeyValueScope to ${serviceId} when CommandNameKeyValueScope is currently set to ${this.#currentServiceIdKeyValueScope}`,
      );
    }
    this.#currentServiceIdKeyValueScope = serviceId;

    logger.debug("currentServiceIdKeyValueScope: %s", serviceId);

    if (!this.#serviceKeyValueData.has(serviceId)) {
      this.#serviceKeyValueData.set(serviceId, new Map());
    }
    this.#defaultKeyValueService!.setKeyValueData(
      this.#serviceKeyValueData.get(serviceId)!,
    );
  }

  /**
   * Indicate that the contained {@link DefaultKeyValueService} should have any current scope cleared.
   *
   * If a scope is currently set and changes have been made to the key-value data, they will be written
   * to the current configuration location.
   */
  public async clearKeyValueScope(): Promise<void> {
    if (!this.keyValueServiceEnabled) {
      throw new Error(
        `Attempt to use KeyValueService which is not enabled`,
      );
    }
    if (this.#defaultKeyValueService!.isDirty()) {
      if (this.configLocation === undefined) {
        throw new Error(
          "Attempt to write updated config with no configLocation set",
        );
      }
      await this.#writeConfig(this.configLocation);
    }
    this.#currentCommandNameKeyValueScope = undefined;
    this.#currentServiceIdKeyValueScope = undefined;

    this.#defaultKeyValueService!.clearKeyValueData();
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
        this.configLocation = path.join(
          home,
          `.${context.cliConfig.name.replace(/\W/g, "")}.json`,
        );
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
          this.defaultsData.set(
            commandName,
            defaults[commandName] as ArgumentValues,
          );
          logger.debug(
            "Set default argument values for command name: %s",
            commandName,
          );
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
            logger.debug(
              "Set default argument values for command name: %s",
              commandName,
            );
          });
        }
        if (keyValues.services !== undefined) {
          const serviceKeyValues = keyValues.services;
          Object.keys(serviceKeyValues).forEach((serviceId) => {
            this.#serviceKeyValueData.set(
              serviceId,
              new Map(Object.entries(serviceKeyValues[serviceId])),
            );
            logger.debug(
              "Set default argument values for service ID: %s",
              serviceId,
            );
          });
        }
      }
    } catch (err) {
      throw new Error(
        `Failed to read config at location: '${this.configLocation}': ${err}`,
      );
    }
  }

  async #writeConfig(location: string): Promise<void> {
    logger.debug("Writing config to: %s", location);

    try {
      await fs.writeFile(location, this.getConfigString());
    } catch (err) {
      throw new Error(
        `Failed to write config at location: '${this.configLocation}': ${err}`,
      );
    }
  }

  public getConfigString(): string {
    const config: {
      defaults?: Record<string, ArgumentValues | ArgumentSingleValueType>;
      "key-values"?: {
        commands?: Record<string, Record<string, string>>;
        services?: Record<string, Record<string, string>>;
      };
    } = {};

    if (this.defaultsData.size > 0) {
      config.defaults = Object.fromEntries(this.defaultsData);
    }
    if (
      (this.#commandKeyValueData.size > 0) ||
      (this.#serviceKeyValueData.size > 0)
    ) {
      config["key-values"] = {};
      if (this.#commandKeyValueData.size > 0) {
        config["key-values"].commands = {};
        for (
          const [commandName, keyValueData] of this.#commandKeyValueData
            .entries()
        ) {
          if (keyValueData.size > 0) {
            config["key-values"].commands[commandName] = Object.fromEntries(
              keyValueData,
            );
          }
        }
      }
      if (this.#serviceKeyValueData.size > 0) {
        config["key-values"].services = {};
        for (
          const [serviceId, keyValueData] of this.#serviceKeyValueData.entries()
        ) {
          if (keyValueData.size > 0) {
            config["key-values"].services[serviceId] = Object.fromEntries(
              keyValueData,
            );
          }
        }
      }
    }
    return JSON.stringify(config, null, 2);
  }
}
