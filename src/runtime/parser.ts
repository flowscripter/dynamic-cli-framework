import type Command from "../api/command/Command.ts";
import type GroupCommand from "../api/command/GroupCommand.ts";
import type {
  ArgumentValueType,
  PopulatedArgumentSingleValueType,
  PopulatedArgumentValues,
} from "../api/argument/ArgumentValueTypes.ts";
import type { InvalidArgument } from "../api/RunResult.ts";
import type { CommandClause } from "./scanner.ts";
import populateGlobalCommandValue from "./values/globalCommandValuePopulation.ts";
import {
  validateGlobalCommandArgumentValue,
  validateOptionValue,
  validatePositionalValue,
} from "./values/argumentValueValidation.ts";
import getLogger from "../util/logger.ts";
import populateSubCommandValues from "./values/subCommandValuePopulation.ts";
import type GlobalCommand from "../api/command/GlobalCommand.ts";
import type SubCommand from "../api/command/SubCommand.ts";

const logger = getLogger("parser");

/**
 * A container holding the result of a {@link CommandClause} parsing operation.
 */
export interface ParseResult {
  /**
   * The {@link Command} to execute if the parse result is valid (i.e. {@link invalidArguments} is empty).
   */
  readonly command: Command;

  /**
   * Optional parent {@link GroupCommand} if the parsed {@link command} was a member {@link SubCommand},
   */
  readonly groupCommand?: GroupCommand;

  /**
   * The argument values populated from the command line args. If the parse result is valid
   * (i.e. {@link invalidArguments} is empty), this can be used to execute the specified {@link command}.
   * {@link PopulatedArgumentSingleValueType} is for {@link GlobalCommand} values, {@link PopulatedArgumentValues} is for
   * {@link SubCommand} values.
   */
  readonly populatedArgumentValues:
    | PopulatedArgumentValues
    | PopulatedArgumentSingleValueType;

  /**
   * Any arguments which were invalid.
   */
  readonly invalidArguments: ReadonlyArray<InvalidArgument>;

  /**
   * Any arguments which were unused in the parsing operation.
   */
  readonly unusedArgs: ReadonlyArray<string>;
}

/**
 * Parse the arguments for the specified {@link CommandClause} assuming it contains a {@link SubCommand}.
 *
 * @param commandClause the clause to parse.
 * @param defaultValues optional default {@link PopulatedArgumentValues} to use for population before parsing the provided arguments.
 */
export function parseSubCommandClause(
  commandClause: CommandClause,
  defaultValues?: PopulatedArgumentValues,
): ParseResult {
  const command = commandClause.command as SubCommand;
  const potentialArgs = commandClause.potentialArgs;
  const groupCommand = commandClause.groupCommand;

  const invalidArguments: Array<InvalidArgument> = [];

  // check if we need to process any arguments at all
  if ((command.options.length === 0) && (command.positionals.length === 0)) {
    return {
      command,
      groupCommand,
      populatedArgumentValues: {},
      invalidArguments,
      unusedArgs: potentialArgs,
    };
  }

  const { populatedArgumentValues, unusedArgs, invalidArgument } =
    populateSubCommandValues(
      command,
      potentialArgs,
      defaultValues,
    );

  if (invalidArgument) {
    invalidArguments.push(invalidArgument);
  }

  if (invalidArguments.length === 0) {
    // validate the option values
    command.options.forEach((option) => {
      const validatedValue = validateOptionValue(
        option,
        populatedArgumentValues[option.name] || option.defaultValue,
        invalidArguments,
      );
      if (validatedValue !== undefined) {
        populatedArgumentValues[option.name] = validatedValue;
      }
    });

    logger.debug(
      "Command arguments after options validated: %O with invalid args: %O",
      populatedArgumentValues,
      invalidArguments,
    );

    if (invalidArguments.length === 0) {
      // validate the positional values
      command.positionals.forEach((positional) => {
        const validatedValue = validatePositionalValue(
          positional,
          populatedArgumentValues[positional.name] as ArgumentValueType,
          invalidArguments,
        );
        if (validatedValue !== undefined) {
          populatedArgumentValues[positional.name] = validatedValue;
        }
      });
      logger.debug(
        "Command arguments after positionals validated: %O with invalid args: %O",
        populatedArgumentValues,
        invalidArguments,
      );
    }
  }
  if (groupCommand) {
    return {
      command,
      populatedArgumentValues,
      groupCommand,
      invalidArguments,
      unusedArgs,
    };
  }
  return {
    command,
    populatedArgumentValues,
    invalidArguments,
    unusedArgs: unusedArgs,
  };
}

/**
 * Parse the arguments for the specified {@link CommandClause} assuming it contains a {@link GlobalCommand} or {@link GlobalModifierCommand}.
 *
 * @param commandClause the clause to parse.
 * @param defaultValue optional default {@link PopulatedArgumentSingleValueType} to use for population before parsing the provided arguments.
 */
export function parseGlobalCommandClause(
  commandClause: CommandClause,
  defaultValue?: PopulatedArgumentSingleValueType,
): ParseResult {
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

  let { populatedArgumentValue, unusedArgs, invalidArgument } =
    populateGlobalCommandValue(
      command,
      potentialArgs,
      defaultValue,
    );

  if (invalidArgument) {
    invalidArguments.push(invalidArgument);
  }

  logger.debug(
    "Command arguments for command: %s after value population: %O with invalid args: %O and unused args: %O",
    command.name,
    populatedArgumentValue,
    invalidArguments,
    unusedArgs,
  );

  // don't validate the value if the argument is already invalid
  if (invalidArguments.length === 0) {
    const validatedValue = validateGlobalCommandArgumentValue(
      command,
      populatedArgumentValue,
      invalidArguments,
    );
    if (validatedValue !== undefined) {
      populatedArgumentValue = validatedValue;
    }
  }

  logger.debug(
    "Command arguments for command: %s after value validation: %O with invalid args: %O",
    command.name,
    populatedArgumentValue,
    invalidArguments,
  );

  return {
    command,
    populatedArgumentValues: populatedArgumentValue,
    invalidArguments,
    unusedArgs,
  };
}
