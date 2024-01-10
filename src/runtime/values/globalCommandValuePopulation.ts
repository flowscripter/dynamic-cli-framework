import GlobalCommand from "../../api/command/GlobalCommand.ts";
import { GlobalCommandValuePopulationResult } from "./ValuePopulationResult.ts";
import {
  ArgumentValueTypeName,
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
    // override with parsed argument value
    populatedArgumentValue = potentialArgs[0];
    unusedArgs = potentialArgs.slice(1);
  }

  // check if there is no value
  if (populatedArgumentValue === undefined) {
    // check if argument type is boolean and therefore command being specified is an implicit value of true
    if (argument.type === ArgumentValueTypeName.BOOLEAN) {
      return {
        populatedArgumentValue: "true",
        unusedArgs,
      };
    }

    // error if the global command argument is not optional
    if (!argument.isOptional) {
      return {
        populatedArgumentValue,
        unusedArgs,
        invalidArgument: {
          name: globalCommand.name,
          reason: InvalidArgumentReason.MISSING_VALUE,
        },
      };
    }
  }

  return {
    populatedArgumentValue,
    unusedArgs,
  };
}
