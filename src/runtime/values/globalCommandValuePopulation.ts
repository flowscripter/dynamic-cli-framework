import type GlobalCommand from "../../api/command/GlobalCommand.ts";
import type { GlobalCommandValuePopulationResult } from "./ValuePopulationResult.ts";
import {
  ArgumentValueTypeName,
} from "../../api/argument/ArgumentValueTypes.ts";
import type {
  PopulatedArgumentSingleValueType,
} from "../../api/argument/ArgumentValueTypes.ts";
import getLogger from "../../util/logger.ts";
import { InvalidArgumentReason } from "../../api/RunResult.ts";

const logger = getLogger("globalCommandValuePopulation");

/**
 * Attempt to populate a {@link ArgumentValueType} for the provided {@link GlobalCommand} using the provided potential args.
 *
 * @param globalCommand the {@link GlobalCommand} for which {@link ArgumentValues} values should be populated.
 * @param potentialArgs the potential args to use for population.
 * @param defaultValue optional default value to use for population before parsing the provided arguments.
 */
export default function populateGlobalCommandValue(
  globalCommand: GlobalCommand,
  potentialArgs: ReadonlyArray<string>,
  defaultValue: PopulatedArgumentSingleValueType,
): GlobalCommandValuePopulationResult {
  logger.debug(() => {
    const message =
      `Populating value for global command: '${globalCommand.name}' using potential args: ${
        potentialArgs.join(" ")
      }`;
    if (defaultValue !== undefined) {
      return `${message} and configured value: '${defaultValue}'`;
    }
    return message;
  });
  const argument = globalCommand.argument!;

  // default to defined argument default value
  let populatedArgumentValue = argument.defaultValue;

  // override with provided configured value
  if (defaultValue !== undefined) {
    populatedArgumentValue = defaultValue;
  }
  let unusedArgs: Array<string> = [];

  if (potentialArgs.length > 0) {
    const firstPotentialArg = potentialArgs[0];

    // don't use potentialArg if it cannot be a boolean value...
    if (argument.type === ArgumentValueTypeName.BOOLEAN) {
      const firstPotentialArgLower = firstPotentialArg.toLowerCase();

      if (
        (firstPotentialArgLower !== "true") &&
        (firstPotentialArgLower !== "false")
      ) {
        // ...instead, use the fact that the argument is present as the value true
        return {
          populatedArgumentValue: "true",
          unusedArgs: potentialArgs,
        };
      }
    }
    // otherwise override with parsed argument value
    populatedArgumentValue = firstPotentialArg;
    unusedArgs = potentialArgs.slice(1);
  } // check if argument type is boolean and therefore command being specified is an implicit value of true
  else if (
    (argument.type === ArgumentValueTypeName.BOOLEAN) &&
    ((populatedArgumentValue === undefined) ||
      (argument.defaultValue === false))
  ) {
    return {
      populatedArgumentValue: "true",
      unusedArgs,
    };
  }

  // check if there is no value and the global command argument is not optional
  if ((populatedArgumentValue === undefined) && !argument.isOptional) {
    return {
      populatedArgumentValue,
      unusedArgs,
      invalidArgument: {
        name: globalCommand.name,
        reason: InvalidArgumentReason.MISSING_VALUE,
      },
    };
  }

  return {
    populatedArgumentValue,
    unusedArgs,
  };
}
