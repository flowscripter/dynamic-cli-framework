import Service, { ServiceInstance } from "../../api/service/Service.ts";
import Command from "../../api/command/Command.ts";
import ConfigCommand from "../../command/core/ConfigCommand.ts";
import {
  ArgumentSingleValueType,
  ArgumentValues,
} from "../../api/argument/ArgumentValueTypes.ts";
import getLogger from "../../util/logger.ts";
import DefaultConfiguration from "./DefaultConfiguration.ts";
import { CONFIGURATION_SERVICE_ID } from "../../api/service/core/Configuration.ts";
import Context from "../../api/runtime/Context.ts";
import DumpConfigCommand from "../../command/core/DumpConfigCommand.ts";

const logger = getLogger("ConfigurationService");

/**
 * Provides configuration functionality as a {@link Service}. Configuration of {@link ArgumentValues} is provided for
 * any {@link Command} instance which has defined {@link Command.enableConfiguration} as `true`.
 *
 * Two sources of configuration are supported:
 *
 * 1. Configuration File: A JSON file where the format matches {@link ArgumentValues}. The first level of value keys
 * refers is used to refer to {@link Command.name} and the contained values are treated as command {@link ArgumentValues}.
 * The default location of the configuration file is `$HOME/.<application_name>.json`. If $HOME is not defined no
 * default configuration will be used. The file location can be modified via the {@link ConfigCommand}. As an example:
 *
 * ```
 * {
 *     "command1": {
 *         "arg1": [
 *             1,
 *             2
 *         ],
 *         "arg2": {
 *             "arg3": "foo"
 *         }
 *     },
 *     "command2": {
 *         "arg4": true
 *     }
 * }
 * ```
 *
 * 2. Environment Variables: Values are parsed using the key defined by {@link Argument.configurationKey} or using
 * the default naming scheme defined within the {@link Argument.configurationKey} comment.
 * Any values set by environment variables will override those sourced from the configuration file.
 *
 * Any configured values from the above sources will be overridden by any arguments provided on the command line.
 */
export default class ConfigurationService implements Service {
  readonly initPriority: number;
  configLocation = "not initialized";

  public readonly configuredArgumentValuesByCommandName = new Map<
    string,
    ArgumentValues | ArgumentSingleValueType
  >();

  /**
   * Create an instance of the service with the specified details.
   * @param initPriority the priority of the service.
   */
  public constructor(initPriority: number) {
    this.initPriority = initPriority;
  }

  // init configuration service:
  //    init: load configuration from default location
  //    provides: config modifier command
  // init other services:
  //    e.g. printer:
  //      provides: log-level modifier command
  //      provides: no-banner modifier command
  //      provides: no-color modifier command

  // run config modifier command if specified:
  //    => which means parsing needs to occur!
  //    => which means printer service needs to be available!
  //    => which means log-level, no-color and no-banner needs to be parsed and run first!
  //    load configuration from specified location argument (and default loaded configuration if any)

  // init plugin service:
  //    init: load installed plugins
  //      use loaded configuration
  //    provides: install command
  //    provides: loaded plugin commands => which means parsing needs to re-occur!
  //    provides: loaded plugin services

  // init other services

  // run other modifier commands specified:
  //    e.g. set log-level:
  //      use specified arguments and loaded configuration
  // run other modifier commands specified in configuration and not specified as argument:
  //    e.g. set no-banner:
  //      use specified arguments and loaded configuration to set no-banner config on printer service
  //      => which means config modifier command needs to be parsed and run first!
  // run any commands provided by service as default modifier commands
  //    e.g. printer:
  //      provides: print-banner 'function'
  // run command specified:
  //    e.g. help:
  //      use specified arguments and loaded configuration


  // SOLVE: plugin service using loaded configuration
  // SOLVE: ad-hoc config storage support for services and commands

  public async init(context: Context): Promise<{
    readonly serviceInstances: ReadonlyArray<ServiceInstance>;
    readonly commands: ReadonlyArray<Command>;
  }> {
    // default to `$HOME/.<application_name>.json`
    const home = Deno.env.get("HOME");
    if (home) {
      await this.setConfigLocation(
        `${home}/.${context.cliConfig.name.replace(/\W/g, "")}.json`,
        true,
      );
    }

    return Promise.resolve({
      serviceInstances: [{
        serviceId: CONFIGURATION_SERVICE_ID,
        instance: new DefaultConfiguration(this),
      }],
      commands: [
        new ConfigCommand(this, this.initPriority),
        new DumpConfigCommand(this)
      ],
    });
  }

  public async setConfigLocation(configLocation: string, isDefault = false) {
    this.configLocation = configLocation;
    let fileInfo: Deno.FileInfo | undefined;
    try {
      fileInfo = await Deno.lstat(configLocation);
    } catch (err) {
      if (isDefault) {
        logger.debug(() =>
          `Default config file location: '${configLocation}' doesn't exist or not visible - ignoring: ${err.message}`
        );
        return;
      } else {
        throw new Error(
          `Config file location: '${configLocation}' doesn't exist or not visible: ${err.message}`,
        );
      }
    }
    if (fileInfo.isDirectory) {
      throw new Error(
        `Config file location: '${configLocation}' is a directory and not a file!`,
      );
    }

    // TODO: 0A - replace configuredArgumentValuesByCommandName with on-demand access to env-var and configured values only when command is run
    // TODO: 0B - assert size of arrays and nesting depth
    // TODO: 0C - load environment variables, based on name and command.enableConfiguration
    // TODO: 0D - use util to map from argument to configuration key
    // TODO: 0E - ...merge in stored environment variables
    try {
      const data = await Deno.readFile(configLocation);
      const decoder = new TextDecoder("utf-8");
      const config = JSON.parse(decoder.decode(data)) as ArgumentValues;
      if (config !== undefined) {
        this.configuredArgumentValuesByCommandName.clear();
        Object.keys(config).forEach((name) => {
          this.configuredArgumentValuesByCommandName.set(
            name,
            config[name] as ArgumentValues | ArgumentSingleValueType,
          );
          logger.debug(() =>
            `Set default argument values for command: ${name}`
          );
        });
      }
    } catch (err) {
      throw new Error(
        `Failed to parse config file at location: '${configLocation}': ${err}`,
      );
    }
  }
}
