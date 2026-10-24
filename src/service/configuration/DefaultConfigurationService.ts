import process from "node:process";
import path from "node:path";
import fs from "node:fs/promises";
import type { Stats } from "node:fs";
import {
  SECRET_SENTINEL_PREFIX,
  type CommandRegistry,
  type ConfigurationService,
  type SingleValueType,
  type ValueNode,
  type Values,
} from "@flowscripter/dynamic-cli-framework-api";
import getLogger from "../../util/logger.ts";
import {
  collectSentinels,
  getConfigTargets,
  maskDefault,
  type ConfigTarget,
} from "./configTargets.ts";
import type DefaultSecretService from "./DefaultSecretService.ts";
import type ConfigFormat from "./format/ConfigFormat.ts";
import type { ConfigData } from "./format/ConfigFormat.ts";
import resolveSecrets from "./resolveSecrets.ts";

const logger = getLogger("DefaultConfigurationService");

export type KeyValueServiceScopeType = "command" | "service";

/**
 * Owns the configuration data read from (and written back to) the configuration file: the default
 * command argument values and the raw per-scope key-value data.
 *
 * The `config` group commands are constructed with this instance. It must never be registered in the
 * {@link Context}: it exposes every command's defaults, the raw key-value data of every scope and secret
 * resolution. Only a location-only view is registered under {@link CONFIGURATION_SERVICE_ID}.
 */
export default class DefaultConfigurationService implements ConfigurationService {
  public readonly envVarsEnabled: boolean;
  public readonly configFormat: ConfigFormat;

  // the location of the currently managed configuration data
  public configLocation: string | undefined;

  // the configuration data used when setting command defaults. SingleValueType is for
  // GlobalCommandArgument values, Values is for SubCommandArgument values.
  public defaultsData: Map<string, Values | SingleValueType> = new Map();

  // the format specific handle for the text last read or written, used to preserve comments and layout on write
  #configHandle: unknown;

  #commandKeyValueData = new Map<string, Map<string, ValueNode>>();
  #serviceKeyValueData = new Map<string, Map<string, ValueNode>>();

  // used only to resolve secret sentinels embedded in default command argument values and to store
  // SECRET values set via the `config` group commands
  #defaultsSecretService: DefaultSecretService | undefined;

  readonly #commandRegistry: CommandRegistry | undefined;

  /**
   * @param envVarsEnabled whether environment variables may override stored default values.
   * @param configFormat the syntax of the configuration file.
   * @param commandRegistry optional registry of all commands, required for {@link getConfigTargets}.
   */
  public constructor(
    envVarsEnabled: boolean,
    configFormat: ConfigFormat,
    commandRegistry?: CommandRegistry,
  ) {
    this.envVarsEnabled = envVarsEnabled;
    this.configFormat = configFormat;
    this.#commandRegistry = commandRegistry;
  }

  public setConfigLocation(location: string): void {
    this.configLocation = location;
  }

  public setDefaultsSecretService(secretService: DefaultSecretService): void {
    this.#defaultsSecretService = secretService;
  }

  /**
   * Resolve any secret sentinels within the value using the OS secret store (if enabled).
   *
   * @param commandKey the key of the command under `defaults` the value belongs to: a sentinel
   * may only refer to a secret stored for this command.
   */
  public async resolveDefaultSecrets<T>(value: T, commandKey: string): Promise<T> {
    if (this.#defaultsSecretService === undefined) {
      return value;
    }
    const secretService = this.#defaultsSecretService;
    return await resolveSecrets<T>(value, async (bunSecretName) => {
      if (!secretService.ownsSecretName(bunSecretName, commandKey)) {
        throw new Error(
          `Secret sentinel '${SECRET_SENTINEL_PREFIX}${bunSecretName}' does not refer to a secret stored for command: '${commandKey}'`,
        );
      }
      const secretValue = await secretService.getSecret(bunSecretName);
      if (secretValue === null) {
        throw new Error(
          `Secret not found in OS secret store for sentinel: '${SECRET_SENTINEL_PREFIX}${bunSecretName}'`,
        );
      }
      return secretValue;
    });
  }

  /**
   * Get-or-create the underlying, raw {@link ValueNode} `Map` for the given scope.
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
   * Write the configuration file, if `isDirty` is true.
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

  /**
   * Determine the configuration location (defaulting to `$HOME/.<application_name>.<format extension>`)
   * and read the configuration from it if it exists.
   *
   * @param applicationName the name of the CLI.
   */
  public async init(applicationName: string): Promise<void> {
    let isDefault = false;
    if (this.configLocation === undefined) {
      isDefault = true;
      const home = process.env["HOME"];
      if (home) {
        this.configLocation = path.join(
          home,
          `.${applicationName.replace(/\W/g, "")}.${this.configFormat.fileExtension}`,
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
      const { data: config, handle } = this.configFormat.parse(data.toString());
      this.#configHandle = handle;

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
      const config = this.#getConfigData();
      const text =
        this.#configHandle === undefined
          ? this.configFormat.serialize(config)
          : this.configFormat.apply(this.#configHandle, config);
      // owner-only when the file is created; an existing file keeps its mode
      await fs.writeFile(location, text, { mode: 0o600 });
      this.#configHandle = this.configFormat.parse(text).handle;
    } catch (err) {
      throw new Error(`Failed to write config at location: '${this.configLocation}': ${err}`);
    }
  }

  public getConfigString(): string {
    return this.configFormat.serialize(this.#getConfigData());
  }

  /**
   * The configuration text with secret sentinels and the values of SECRET typed arguments of
   * known commands masked.
   */
  public getMaskedConfigString(): string {
    const data = this.#getConfigData();
    const targets = this.getConfigTargets();
    const masked: ConfigData = maskDefault(undefined, data) as ConfigData;
    if (data.defaults !== undefined) {
      masked.defaults = Object.fromEntries(
        Object.entries(data.defaults).map(([key, value]) => [
          key,
          maskDefault(targets.get(key), value),
        ]),
      );
    }
    return this.configFormat.serialize(masked);
  }

  /**
   * The commands whose defaults can be managed via the `config` group commands.
   */
  public getConfigTargets(): Map<string, ConfigTarget> {
    return this.#commandRegistry === undefined
      ? new Map()
      : getConfigTargets(this.#commandRegistry);
  }

  /**
   * Replace (or remove, if `build` returns `undefined`) the stored defaults of a command and write the
   * configuration file immediately. Memory, file and secret store are left unchanged if anything fails.
   *
   * @param commandKey the key of the command under `defaults`.
   * @param secrets plain text secrets to store in the OS secret store, keyed to be used for naming.
   * @param build creates the new value given the sentinels (one per secret) to reference the stored secrets.
   */
  public async commitDefault(
    commandKey: string,
    secrets: ReadonlyArray<{ key: ReadonlyArray<string>; value: string }>,
    build: (sentinels: ReadonlyArray<string>) => Values | SingleValueType | undefined,
  ): Promise<void> {
    if (this.configLocation === undefined) {
      throw new Error("Unable to write config: no config location is set and $HOME is not defined");
    }
    if (secrets.length > 0 && this.#defaultsSecretService === undefined) {
      throw new Error("Unable to store a SECRET value: the secret service is not enabled");
    }
    const secretService = this.#defaultsSecretService;
    const previous = this.defaultsData.get(commandKey);
    const restores: Array<() => Promise<unknown>> = [];
    const sentinels: Array<string> = [];
    try {
      for (const { key, value } of secrets) {
        const name = secretService!.secretName(key);
        const old = await secretService!.getSecret(name);
        await secretService!.setSecret(key, value);
        restores.push(() =>
          old === null ? secretService!.deleteSecret(name) : secretService!.setSecret(key, old),
        );
        sentinels.push(`${SECRET_SENTINEL_PREFIX}${name}`);
      }
      const next = build(sentinels);
      if (next === undefined) {
        this.defaultsData.delete(commandKey);
      } else {
        this.defaultsData.set(commandKey, next);
      }
      await this.#writeConfig(this.configLocation);
      const kept = new Set(collectSentinels(next));
      for (const sentinel of collectSentinels(previous)) {
        if (!kept.has(sentinel) && secretService !== undefined) {
          await secretService.deleteSecret(sentinel.slice(SECRET_SENTINEL_PREFIX.length));
        }
      }
    } catch (err) {
      if (previous === undefined) {
        this.defaultsData.delete(commandKey);
      } else {
        this.defaultsData.set(commandKey, previous);
      }
      for (const restore of restores.reverse()) {
        await restore().catch(() => undefined);
      }
      throw err;
    }
  }

  #getConfigData(): ConfigData {
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
    return config;
  }
}
