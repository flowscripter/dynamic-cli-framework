import process from "node:process";
import type Command from "../api/command/Command.ts";
import type CLIConfig from "../api/CLIConfig.ts";
import {
  ArgumentValueTypeName,
  ComplexValueTypeName,
  type PopulatedArgumentSingleValueType,
  type PopulatedArgumentValues,
} from "../api/argument/ArgumentValueTypes.ts";
type ProcessEnv = NodeJS.ProcessEnv;

import type SubCommandArgument from "../api/argument/SubCommandArgument.ts";
import {
  MAXIMUM_ARGUMENT_ARRAY_SIZE,
} from "../api/argument/SubCommandArgument.ts";
import type Option from "../api/argument/Option.ts";
import type GlobalCommandArgument from "../api/argument/GlobalCommandArgument.ts";
import type GlobalCommand from "../api/command/GlobalCommand.ts";
import type SubCommand from "../api/command/SubCommand.ts";
import type ComplexOption from "../api/argument/ComplexOption.ts";

function getKeySegment(segment: string) {
  let keySegment = segment.replace("-", "_").toUpperCase();
  if (keySegment[0].match(/[0-9]/)) {
    keySegment = `_${keySegment}`;
  }
  return keySegment;
}

function getSubCommandArgumentKeyPrefix(
  cliConfig: CLIConfig,
  command: Command,
  subCommandArgument: SubCommandArgument,
) {
  if (subCommandArgument.configurationKey) {
    return subCommandArgument.configurationKey;
  }
  return `${getKeySegment(cliConfig.name)}_${getKeySegment(command.name)}_${
    getKeySegment(subCommandArgument.name)
  }`;
}

function getGlobalArgumentKeyPrefix(
  cliConfig: CLIConfig,
  command: Command,
  globalCommandArgument: GlobalCommandArgument,
) {
  if (globalCommandArgument.configurationKey) {
    return globalCommandArgument.configurationKey;
  }
  return `${getKeySegment(cliConfig.name)}_${getKeySegment(command.name)}`;
}

/**
 * Get configured argument value for the specified {@link GlobalCommandArgument} from environment variables.
 *
 * @param cliConfig the {@link CLIConfig} to use for determining the default configuration key.
 * @param command the {@link GlobalCommand} to use for determining the default configuration key and containing a
 * {@link GlobalCommandArgument} instance to populate a value for.
 */
export function getGlobalCommandValueFromEnvVars(
  cliConfig: CLIConfig,
  command: GlobalCommand,
): PopulatedArgumentSingleValueType {
  const { argument } = command;
  if (argument === undefined) {
    return undefined;
  }

  // simple check for a specific env var name
  let envVarValue = process.env[
    getGlobalArgumentKeyPrefix(cliConfig, command, argument)
  ];
  if (
    (envVarValue != undefined) &&
    (argument.type === ArgumentValueTypeName.BOOLEAN)
  ) {
    envVarValue = (envVarValue.length > 0) ? "true" : "false";
  }

  return envVarValue;
}

function getOptionValuesFromEnvVars(
  envVarValues: PopulatedArgumentValues,
  potentialEnvVarNames: Array<string>,
  env: ProcessEnv,
  option: Option | ComplexOption,
  envVarNamePrefix: string,
) {
  if (potentialEnvVarNames.length === 0) {
    return;
  }

  if (
    option.name === "__proto__" || option.name === "constructor" ||
    option.name === "prototype"
  ) {
    throw new Error(
      `Unsafe key name in use: ${option.name}, CodeQL Rule ID: js/prototype-polluting-assignment`,
    );
  }

  if (option.isArray) {
    envVarNamePrefix = `${envVarNamePrefix}_`;

    const matches = potentialEnvVarNames.filter((envVarName) =>
      envVarName.startsWith(envVarNamePrefix)
    );
    matches.forEach((match) => {
      const path = match.substring(envVarNamePrefix.length);

      // either '1' or '1_property...' or 'something_invalid'....
      let indexString = path;
      let suffix = "";
      const indexOf = path.indexOf("_");
      if (indexOf > -1) {
        indexString = path.substring(0, indexOf);
        if (indexOf + 1 < path.length) {
          suffix = path.substring(indexOf + 1);
        }
      }
      let index: number;
      try {
        index = parseInt(indexString);
      } catch (_err) {
        throw new Error(`Unable to parse array index from env var: ${match}`);
      }
      if (index !== undefined) {
        if (index > MAXIMUM_ARGUMENT_ARRAY_SIZE) {
          throw new Error(
            `Maximum array size exceeded: ${index} in env var: ${match}`,
          );
        }
        if (envVarValues[option.name] === undefined) {
          envVarValues[option.name] = [];
        }
        if (suffix.length > 0) {
          if (option.type === ComplexValueTypeName.COMPLEX) {
            if (
              (envVarValues[option.name] as Array<
                PopulatedArgumentSingleValueType
              >)[index] === undefined
            ) {
              (envVarValues[option.name] as Array<PopulatedArgumentValues>)[
                index
              ] = {};
            }
            (option as ComplexOption).properties.forEach((property) => {
              const propertySegment = property.configurationKey ||
                getKeySegment(property.name);
              getOptionValuesFromEnvVars(
                (envVarValues[option.name] as Array<PopulatedArgumentValues>)[
                  index
                ],
                matches,
                env,
                property,
                `${envVarNamePrefix}${index}_${propertySegment}`,
              );
            });
            if (
              Object.keys(
                (envVarValues[option.name] as Array<PopulatedArgumentValues>)[
                  index
                ] as Record<string, string>,
              ).length === 0
            ) {
              delete (envVarValues[option.name] as Array<
                PopulatedArgumentValues
              >)[index];
            }
          } else {
            throw new Error(
              `Unidentified suffix ${suffix} in env var: ${match}`,
            );
          }
        } else if (option.type === ComplexValueTypeName.COMPLEX) {
          throw new Error(`Incomplete argument path in env var: ${match}`);
        } else {
          // set primitive value
          let envVarValue = env[match];
          if (
            (envVarValue != undefined) &&
            (option.type === ArgumentValueTypeName.BOOLEAN)
          ) {
            envVarValue = envVarValue.length > 1 ? "true" : "false";
          }
          (envVarValues[option.name] as Array<
            PopulatedArgumentSingleValueType
          >)[
            index
          ] = envVarValue;
        }

        const elements = envVarValues[option.name] as Array<
          PopulatedArgumentSingleValueType
        >;
        for (let i = elements.length - 1; i > -1; i--) {
          if (elements[i] === undefined) {
            elements.length = i;
          }
        }
        if (elements.length === 0) {
          delete envVarValues[option.name];
        }
      }
    });
  } else if (option.type === ComplexValueTypeName.COMPLEX) {
    (option as ComplexOption).properties.forEach((property) => {
      if (envVarValues[option.name] === undefined) {
        envVarValues[option.name] = {};
      }
      const propertySegment = property.configurationKey ||
        getKeySegment(property.name);
      getOptionValuesFromEnvVars(
        envVarValues[option.name] as PopulatedArgumentValues,
        potentialEnvVarNames,
        env,
        property,
        `${envVarNamePrefix}_${propertySegment}`,
      );
      if (
        Object.keys(envVarValues[option.name] as Record<string, string>)
          .length === 0
      ) {
        delete envVarValues[option.name];
      }
    });
  } else {
    // simple check for a specific env var name
    let value = process.env[envVarNamePrefix];
    if (value === undefined) {
      return undefined;
    }
    if (option.type === ArgumentValueTypeName.BOOLEAN) {
      value = value.length > 1 ? "true" : "false";
    }
    // set primitive value
    envVarValues[option.name] = value;
  }
}

/**
 * Get configured argument values for the specified {@link Option} from environment variables.
 *
 * @param cliConfig the {@link CLIConfig} to use for determining the default configuration key.
 * @param command the {@link SubCommand} to use for determining the default configuration key and containing
 * {@link Positional} and {@link Option} instances to populate values for.
 */
export function getSubCommandValuesFromEnvVars(
  cliConfig: CLIConfig,
  command: SubCommand,
): PopulatedArgumentValues | undefined {
  const envVarValues: PopulatedArgumentValues = {};
  if (command.options) {
    for (const option of command.options) {
      const potentialEnvVarNames = Object.keys(process.env);
      const optionPrefix = getSubCommandArgumentKeyPrefix(
        cliConfig,
        command,
        option as Option,
      );
      getOptionValuesFromEnvVars(
        envVarValues,
        potentialEnvVarNames,
        process.env ?? {},
        option,
        optionPrefix,
      );
    }
  }
  if (command.positionals) {
    for (const positional of command.positionals) {
      let envVarNamePrefix = getSubCommandArgumentKeyPrefix(
        cliConfig,
        command,
        positional,
      );

      if (positional.isVarargMultiple) {
        envVarNamePrefix = `${envVarNamePrefix}_`;

        const matches = Object.keys(process.env).filter((envVarName) =>
          envVarName.startsWith(envVarNamePrefix)
        );
        matches.forEach((match) => {
          let index;
          try {
            index = parseInt(match.substring(envVarNamePrefix.length));
          } catch (_err) {
            throw new Error(
              `Unable to parse array index from env var: ${match}`,
            );
          }
          if (index !== undefined) {
            if (index > MAXIMUM_ARGUMENT_ARRAY_SIZE) {
              throw new Error(
                `Maximum array size exceeded: ${index} in env var: ${match}`,
              );
            }
            if (envVarValues[positional.name] === undefined) {
              envVarValues[positional.name] = [];
            }
            // set primitive value
            let envVarValue = process.env[match];
            if (
              (envVarValue != undefined) &&
              (positional.type === ArgumentValueTypeName.BOOLEAN)
            ) {
              envVarValue = envVarValue.length > 1 ? "true" : "false";
            }
            (envVarValues[positional.name] as Array<
              PopulatedArgumentSingleValueType
            >)[index] = envVarValue;
          }
        });
      } else {
        // simple check for a specific env var name
        let value = process.env[envVarNamePrefix];
        if (value === undefined) {
          return undefined;
        }
        if (positional.type === ArgumentValueTypeName.BOOLEAN) {
          value = value.length > 1 ? "true" : "false";
        }
        // set primitive value
        envVarValues[positional.name] = value;
      }
    }
  }

  // Check if anything was actually populated
  if (Object.keys(envVarValues).length === 0) {
    return undefined;
  }
  return envVarValues;
}
