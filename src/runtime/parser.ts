import type {
  ValueType,
  PopulatedSingleValueType,
  PopulatedValues,
} from "@flowscripter/dynamic-cli-framework-api";
import type { InvalidArgument } from "@flowscripter/dynamic-cli-framework-api";
import type { ParseResult } from "@flowscripter/dynamic-cli-framework-api";
import type { CommandClause } from "./scanner.ts";
import populateGlobalCommandValue from "./values/globalCommandValuePopulation.ts";
import {
  validateGlobalCommandArgumentValue,
  validateOptionValue,
  validatePositionalValue,
  runCustomValidation,
  type DeferredCustomValidation,
} from "./values/argumentValueValidation.ts";
import getLogger from "../util/logger.ts";
import { redactGlobalCommandValue, redactSubCommandValues } from "../util/secretRedaction.ts";
import populateSubCommandValues from "./values/subCommandValuePopulation.ts";
import type { GlobalCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";

const logger = getLogger("parser");

export type { ParseResult } from "@flowscripter/dynamic-cli-framework-api";

/**
 * A {@link ParseResult} which also reports any SECRET arguments supplied as plain command line arguments.
 */
export type SecretAwareParseResult = ParseResult & {
  readonly secretArgumentNames?: ReadonlyArray<string>;
};

/**
 * Parse the arguments for the specified {@link CommandClause} assuming it contains a {@link SubCommand}.
 *
 * @param commandClause the clause to parse.
 * @param defaultValues optional default {@link PopulatedValues} to use for population before parsing the provided arguments.
 */
export function parseSubCommandClause(
  commandClause: CommandClause,
  defaultValues?: PopulatedValues,
): SecretAwareParseResult {
  const command = commandClause.command as SubCommand;
  const potentialArgs = commandClause.potentialArgs;
  const groupCommand = commandClause.groupCommand;

  const invalidArguments: Array<InvalidArgument> = [];

  // check if we need to process any arguments at all
  if (command.options.length === 0 && command.positionals.length === 0) {
    return {
      command,
      groupCommand,
      populatedArgumentValues: {},
      invalidArguments,
      unusedArgs: potentialArgs,
    };
  }

  const { populatedArgumentValues, unusedArgs, invalidArgument, secretArgumentNames } =
    populateSubCommandValues(command, potentialArgs, defaultValues);

  if (invalidArgument) {
    invalidArguments.push(invalidArgument);
  }

  if (invalidArguments.length === 0) {
    const deferred: Array<DeferredCustomValidation> = [];
    // validate the option values
    command.options.forEach((option) => {
      const validatedValue = validateOptionValue(
        option,
        populatedArgumentValues[option.name] || option.defaultValue,
        invalidArguments,
        deferred,
      );
      if (validatedValue !== undefined) {
        populatedArgumentValues[option.name] = validatedValue;
      }
    });

    logger.debug(
      "Command arguments after options validated: %O with invalid args: %O",
      redactSubCommandValues(command, populatedArgumentValues),
      invalidArguments,
    );

    if (invalidArguments.length === 0) {
      // validate the positional values
      command.positionals.forEach((positional) => {
        const validatedValue = validatePositionalValue(
          positional,
          populatedArgumentValues[positional.name] as ValueType,
          invalidArguments,
          deferred,
        );
        if (validatedValue !== undefined) {
          populatedArgumentValues[positional.name] = validatedValue;
        }
      });
      if (invalidArguments.length === 0) {
        // custom validators run once all built-in validation has passed and see all values
        runCustomValidation(deferred, command, populatedArgumentValues, invalidArguments);
      }
      logger.debug(
        "Command arguments after positionals validated: %O with invalid args: %O",
        redactSubCommandValues(command, populatedArgumentValues),
        invalidArguments,
      );
    }
  }
  const secrets = secretArgumentNames ? { secretArgumentNames } : {};
  if (groupCommand) {
    return {
      command,
      populatedArgumentValues,
      groupCommand,
      invalidArguments,
      unusedArgs,
      ...secrets,
    };
  }
  return {
    command,
    populatedArgumentValues,
    invalidArguments,
    unusedArgs: unusedArgs,
    ...secrets,
  };
}

/**
 * Parse the arguments for the specified {@link CommandClause} assuming it contains a {@link GlobalCommand} or {@link GlobalModifierCommand}.
 *
 * @param commandClause the clause to parse.
 * @param defaultValue optional default {@link PopulatedSingleValueType} to use for population before parsing the provided arguments.
 */
export function parseGlobalCommandClause(
  commandClause: CommandClause,
  defaultValue?: PopulatedSingleValueType,
): SecretAwareParseResult {
  const command = commandClause.command as GlobalCommand;
  const potentialArgs = commandClause.potentialArgs;
  const invalidArguments: Array<InvalidArgument> = [];

  // check if we need to process an argument at all
  if (!command.argument) {
    return {
      command,
      populatedArgumentValues: undefined,
      invalidArguments,
      unusedArgs: potentialArgs,
    };
  }

  let { populatedArgumentValue, unusedArgs, invalidArgument, secretArgumentNames } =
    populateGlobalCommandValue(command, potentialArgs, defaultValue);

  if (invalidArgument) {
    invalidArguments.push(invalidArgument);
  }

  logger.debug(
    "Command arguments for command: %s after value population: %O with invalid args: %O and unused args: %O",
    command.name,
    redactGlobalCommandValue(command, populatedArgumentValue),
    invalidArguments,
    unusedArgs,
  );

  // don't validate the value if the argument is already invalid
  if (invalidArguments.length === 0) {
    const deferred: Array<DeferredCustomValidation> = [];
    const validatedValue = validateGlobalCommandArgumentValue(
      command,
      populatedArgumentValue,
      invalidArguments,
      deferred,
    );
    if (validatedValue !== undefined) {
      populatedArgumentValue = validatedValue;
    }
    if (invalidArguments.length === 0) {
      runCustomValidation(deferred, command, populatedArgumentValue, invalidArguments);
    }
  }

  logger.debug(
    "Command arguments for command: %s after value validation: %O with invalid args: %O",
    command.name,
    redactGlobalCommandValue(command, populatedArgumentValue),
    invalidArguments,
  );

  return {
    command,
    populatedArgumentValues: populatedArgumentValue,
    invalidArguments,
    unusedArgs,
    ...(secretArgumentNames && { secretArgumentNames }),
  };
}
