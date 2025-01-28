import type Option from "../../api/argument/Option.ts";
import type SubCommand from "../../api/command/SubCommand.ts";
import {
  type ArgumentSingleValueType,
  ArgumentValueTypeName,
  type PopulatedArgumentSingleValueType,
  type PopulatedArgumentValues,
  type PopulatedArgumentValueType,
} from "../../api/argument/ArgumentValueTypes.ts";
import getLogger from "../../util/logger.ts";
import argumentValueMerge from "./argumentValueMerge.ts";
import type { SubCommandValuePopulationResult } from "./ValuePopulationResult.ts";
import type ComplexOption from "../../api/argument/ComplexOption.ts";
import {
  MAXIMUM_COMPLEX_OPTION_NESTING_DEPTH,
} from "../../api/argument/ComplexOption.ts";
import { isComplexOption } from "../argument/ArgumentTypeGuards.ts";
import {
  type InvalidArgument,
  InvalidArgumentReason,
} from "../../api/RunResult.ts";
import { MAXIMUM_ARGUMENT_ARRAY_SIZE } from "../../api/argument/SubCommandArgument.ts";

const logger = getLogger("subCommandValuePopulation");

/**
 * Parse states for parsing loop logic
 */
enum ParseState {
  /**
   * Initial state: expecting either an {@link Option} argument (`--x`, `-x`, `--x=y`, `-x=y`) or {@link Positional} value next.
   */
  EMPTY = 0,

  /**
   * Error while parsing.
   */
  ERROR = 1,

  /**
   * The argument was not used.
   */
  UNUSED = 2,

  /**
   * Found an {@link Option} name, expecting an {@link Option} value next.
   */
  OPTION_VALUE_EXPECTED = 3,
}

/**
 * Context container for the state of the parsing loop.
 */
class ParseContext {
  /**
   * The {@link SubCommand} for which args are being parsed.
   */
  subCommand: SubCommand;

  /**
   * The current populated values for the sub-command.
   */
  populatedArgumentValues: PopulatedArgumentValues;

  /**
   * Current parse state.
   */
  state: ParseState;

  /**
   * If {@link state} = {@link ParseState.ERROR} this will be populated with the details.
   */
  invalidArgument?: InvalidArgument;

  /**
   * An array of either option names or indices used to navigate through the {@link populatedArgumentValues} when
   * setting a value for the {@link currentOption}.
   */
  currentOptionPath?: Array<string | number>;

  /**
   * An optional reference to the current {@link Option} being addressed when {@link state} = {@link ParseState.OPTION_VALUE_EXPECTED}.
   */
  currentOption?: Option;

  /**
   * Current index of {@link Positional} defined for the current {@link SubCommand} being passed
   * which will be populated with a positional value if found.
   */
  currentPositionalIndex;

  /**
   * Use to store lazily created map of option paths e.g. --alpha.b.g and -a.b.gamma for {@link ComplexOption} or {@link Option} instances.
   */
  optionLookupMapsByPath: Map<string, Map<string, Option | ComplexOption>>;

  /**
   * Use to store map of root {@link ComplexOption} or {@link Option} instances by name.
   */
  rootOptionsByName: Map<string, Option | ComplexOption>;

  /**
   * Use to store map of root {@link ComplexOption} or {@link Option} instances by short alias.
   */
  rootOptionsByAlias: Map<string, Option | ComplexOption>;

  /**
   * Create a new instance with {@link state} = {@link ParseState.EMPTY} for the specified {@link SubCommand}.
   *
   * @param subCommand the {@link SubCommand} for which args are being parsed.
   */
  constructor(subCommand: SubCommand) {
    this.subCommand = subCommand;
    this.state = ParseState.EMPTY;
    this.populatedArgumentValues = {};
    this.currentPositionalIndex = 0;
    this.optionLookupMapsByPath = new Map();
    this.rootOptionsByName = new Map();
    this.rootOptionsByAlias = new Map();
    subCommand.options.forEach((option) => {
      this.rootOptionsByName.set(option.name, option);
      if (option.shortAlias) {
        this.rootOptionsByAlias.set(option.shortAlias, option);
      }
    });
  }

  /**
   * Attempt to parse the {@link Option} path specified by the provided option argument.
   *
   * NOTE: the provided path could:
   *
   * * be either a reference to a simple option or a property on a nested complex option: `foo` or `alpha.beta.gamma.delta`
   * * include either the option names or short aliases may be specified: `alpha.b.gamma.d`
   * * include array indices e.g. `alpha[0].beta.gamma[1].delta`
   *
   * @param optionPath the option path argument to parse.
   *
   * @return `true` if successful, which means either:
   * 1. the {@link state} will be set to {@link ParseState.OPTION_VALUE_EXPECTED} and the {@link currentOptionPath} and {@link currentOption} will be populated OR
   * 2. the option path was not recognised as an option for the current sub-command.
   * If `false` the {@link state} will be set to
   * {@link ParseState.ERROR} and {@link invalidArgument} will be populated. This will be the case if the specified option path was initially
   * found to be referring to a complex property for the current sub-command but parsing the entire path failed either due to an invalid expression
   * or an unknown property.
   */
  #parseOptionPath(optionPath: string): boolean {
    logger.debug("Parsing option path: %s", optionPath);
    this.currentOptionPath = undefined;
    this.currentOption = undefined;

    // split up the path into elements
    const complexPathElements = optionPath.split(
      ".",
      MAXIMUM_COMPLEX_OPTION_NESTING_DEPTH + 1,
    );

    // check nesting depth
    if (complexPathElements.length > MAXIMUM_COMPLEX_OPTION_NESTING_DEPTH) {
      this.invalidArgument = {
        name: optionPath,
        reason: InvalidArgumentReason.NESTING_DEPTH_EXCEEDED,
      };
      this.state = ParseState.ERROR;
      return false;
    }

    const complexAndArrayPathElements: Array<string | number> = [];
    let option: Option | ComplexOption | undefined = undefined;
    let currentValue:
      | PopulatedArgumentValues
      | Array<PopulatedArgumentValues | PopulatedArgumentValueType>
      | PopulatedArgumentValueType
      | undefined = this.populatedArgumentValues;

    for (let i = 0; i < complexPathElements.length; i++) {
      let arrayIndexString: string | undefined;
      let complexPathElement = complexPathElements[i];

      // look for array index
      if (complexPathElement.endsWith("]")) {
        [complexPathElement, arrayIndexString] = complexPathElement.slice(
          0,
          complexPathElement.length - 1,
        ).split("[");
      }

      let lookupPath = this.subCommand.name;

      // root option navigation
      if (i === 0) {
        if (complexPathElement.startsWith("--")) {
          complexPathElement = complexPathElement.slice(2);
          option = this.rootOptionsByName.get(complexPathElement);
        } else {
          complexPathElement = complexPathElement.slice(1);
          // ignore if illegal syntax of `-more_than_one_letter`
          if (complexPathElement.length > 1) {
            this.state = ParseState.UNUSED;
            return false;
          }
          option = this.rootOptionsByAlias.get(complexPathElement);
        }

        // if path doesn't refer to an option don't use it
        if (option === undefined) {
          return true;
        }

        // if we did find an option make sure we using the name and not the alias
        complexPathElement = option.name;
      } // complex option property navigation
      else {
        lookupPath = `${lookupPath}${option!.name}`;

        // lazy creation of nested option paths to options
        if (!this.optionLookupMapsByPath.has(lookupPath)) {
          const properties = (option! as ComplexOption).properties;

          if (properties === undefined) {
            this.invalidArgument = {
              name: optionPath,
              reason: InvalidArgumentReason.UNKNOWN_PROPERTY,
            };
            this.state = ParseState.ERROR;
            return false;
          }

          const lookupMap = new Map();
          properties.forEach((option) => {
            lookupMap.set(option.name, option);
            if (option.shortAlias) {
              lookupMap.set(option.shortAlias, option);
            }
          });
          this.optionLookupMapsByPath.set(lookupPath, lookupMap);
        }
        option = this.optionLookupMapsByPath.get(lookupPath)!.get(
          complexPathElement,
        );

        // now we are parsing properties of complex options it is an error if we cannot match an option name or alias
        if (option === undefined) {
          this.invalidArgument = {
            name: optionPath,
            reason: InvalidArgumentReason.UNKNOWN_PROPERTY,
          };
          this.state = ParseState.ERROR;
          return false;
        }

        // ensure we convert to option name if lookup was via option alias
        complexPathElement = option.name;
      }

      // check index size
      let arrayIndex: number | undefined;
      if (arrayIndexString !== undefined) {
        const parsedArrayIndex = parseInt(arrayIndexString);
        if (Number.isInteger(parsedArrayIndex)) {
          if (parsedArrayIndex > MAXIMUM_ARGUMENT_ARRAY_SIZE) {
            this.invalidArgument = {
              argument: option,
              name: option!.name,
              reason: InvalidArgumentReason.ARRAY_SIZE_EXCEEDED,
            };
            this.state = ParseState.ERROR;
            return false;
          }
          arrayIndex = parsedArrayIndex;
        }
      }

      // check for indexing when not allowed
      if (!option.isArray && (arrayIndex !== undefined)) {
        this.invalidArgument = {
          argument: option,
          name: optionPath,
          reason: InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES,
        };
        this.state = ParseState.ERROR;
        return false;
      }

      if (
        (currentValue as PopulatedArgumentValues)[complexPathElement] ===
          undefined
      ) {
        // ensure we have a placeholder value
        if (option.isArray) {
          currentValue =
            (currentValue as PopulatedArgumentValues)[complexPathElement] =
              [];

          if (isComplexOption(option)) {
            // if we are retrieving a property by name only use the last entry in the array by default
            // (this is the scenario when array indices are implicit)
            let index = 0;
            if (arrayIndex !== undefined) {
              index = arrayIndex;
            }
            currentValue = currentValue[index] = {};
          }
        } else if (isComplexOption(option)) {
          currentValue =
            (currentValue as PopulatedArgumentValues)[complexPathElement] =
              {};
        }
      } else {
        currentValue = (currentValue as PopulatedArgumentValues)[
          complexPathElement
        ] as PopulatedArgumentValues;
        if (Array.isArray(currentValue)) {
          // if we are retrieving a property by name only use the last entry in the array by default
          // (this is the scenario when array indices are implicit)
          let index: number = currentValue.length - 1;
          if (arrayIndex !== undefined) {
            index = arrayIndex;
          }

          if ((currentValue[index] === undefined) && isComplexOption(option)) {
            // ensure we have a placeholder value
            currentValue = currentValue[index] = {};
          } else {
            currentValue = currentValue[index];
          }
        }
      }

      // add to the path elements
      complexAndArrayPathElements.push(complexPathElement);
      if (arrayIndex !== undefined) {
        complexAndArrayPathElements.push(arrayIndex);
      }
    }

    // if path doesn't refer to an option don't use it
    if (option === undefined) {
      return true;
    }

    // check if path ends up referring to a non-primitive
    if (isComplexOption(option)) {
      this.invalidArgument = {
        argument: option,
        name: option.name,
        reason: InvalidArgumentReason.OPTION_IS_COMPLEX,
      };
      this.state = ParseState.ERROR;
      return false;
    }

    this.currentOptionPath = complexAndArrayPathElements;
    this.currentOption = option;

    this.state = ParseState.OPTION_VALUE_EXPECTED;

    return true;
  }

  /**
   * Attempt to set the value for the current {@link Option}.
   *
   * @param value the value to attempt to set.
   *
   * @return `false` if there is a problem populating the value, in which case the {@link state} will be set to
   * {@link ParseState.ERROR} and {@link invalidArgument} will be populated.
   */
  setOptionValue(value: ArgumentSingleValueType): boolean {
    let optionValue:
      | Array<PopulatedArgumentValues>
      | PopulatedArgumentValues
      | PopulatedArgumentValueType = this.populatedArgumentValues;
    const optionPath = this.currentOptionPath as Array<string | number>;

    // traverse the current populated values using the validated option path elements
    for (let i = 0; i < optionPath.length; i++) {
      const pathElement = optionPath[i];

      // if on last path element, set the value
      if (i === optionPath.length - 1) {
        if (typeof pathElement === "string") {
          const currentValue =
            (optionValue as PopulatedArgumentValues)[pathElement as string];

          // if we haven't populated the argument value before...
          if (currentValue === undefined) {
            (optionValue as PopulatedArgumentValues)[pathElement as string] =
              value;
          } // if we have already populated the argument value as an array...
          else if (Array.isArray(currentValue)) {
            if (currentValue.length === MAXIMUM_ARGUMENT_ARRAY_SIZE) {
              this.invalidArgument = {
                argument: this.currentOption,
                name: this.currentOption!.name,
                reason: InvalidArgumentReason.ARRAY_SIZE_EXCEEDED,
              };
              this.state = ParseState.ERROR;
              return false;
            }
            // push the new value
            (currentValue as Array<PopulatedArgumentSingleValueType>).push(
              value,
            );
          } // else the value to add would make an array where it is not allowed
          else {
            this.invalidArgument = {
              argument: this.currentOption,
              name: this.currentOption!.name,
              reason: InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES,
            };
            this.state = ParseState.ERROR;
            return false;
          }
        } else {
          // set the new value on the array
          (optionValue as Array<
            PopulatedArgumentValueType | PopulatedArgumentValues
          >)[pathElement as number] = value;
        }
      } // otherwise continue to navigate the path
      else {
        if (typeof pathElement === "string") {
          if (Array.isArray(optionValue)) {
            optionValue = (optionValue as Array<PopulatedArgumentValues>)[
              optionValue.length - 1
            ][pathElement as string] as
              | Array<PopulatedArgumentValues>
              | PopulatedArgumentValues
              | PopulatedArgumentValueType;
          } else {
            optionValue =
              (optionValue as PopulatedArgumentValues)[pathElement as string] as
                | Array<PopulatedArgumentValues>
                | PopulatedArgumentValues
                | PopulatedArgumentValueType;
          }
        } else {
          optionValue = (optionValue as Array<
            PopulatedArgumentSingleValueType | PopulatedArgumentValues
          >)[pathElement as number];
        }
      }
    }

    // Update the state
    this.currentOption = undefined;
    this.currentOptionPath = undefined;
    this.state = ParseState.EMPTY;

    return true;
  }

  /**
   * Attempt to set the value for the current {@link Positional}.
   * If there is a problem populating the value the {@link state} will be set to
   * {@link ParseState.ERROR} and {@link invalidArgument} will be populated.
   *
   * @param value the value to attempt to set.
   */
  setPositionalValue(value: ArgumentSingleValueType): boolean {
    const positional = this.subCommand.positionals[this.currentPositionalIndex];
    const currentValue = this.populatedArgumentValues[positional.name];

    // if we haven't populated the argument value before...
    if (currentValue === undefined) {
      if (positional.isVarargMultiple) {
        this.populatedArgumentValues[positional.name] = [value];
      } else {
        this.populatedArgumentValues[positional.name] = value;
      }
    } // if we have already populated the argument value as an array...
    else if (Array.isArray(currentValue)) {
      if (currentValue.length === MAXIMUM_ARGUMENT_ARRAY_SIZE) {
        this.invalidArgument = {
          argument: positional,
          name: positional.name,
          reason: InvalidArgumentReason.ARRAY_SIZE_EXCEEDED,
        };
        this.state = ParseState.ERROR;

        return false;
      }
      this.populatedArgumentValues[positional.name] = [
        ...currentValue as Array<PopulatedArgumentSingleValueType>,
        value,
      ] as Array<PopulatedArgumentSingleValueType>;
    }

    // Update the state
    if (!positional.isVarargMultiple) {
      this.currentPositionalIndex += 1;
    }
    this.state = ParseState.EMPTY;

    return true;
  }

  /**
   * Attempt to parse the next argument and update the state of this context based on the result.
   *
   * @param potentialArg the argument to parse
   */
  parse(potentialArg: string) {
    if (this.state === ParseState.OPTION_VALUE_EXPECTED) {
      // If the potential arg is a potential value, check if it is a non-boolean value
      // and if so, see if the current option is boolean. In this scenario prefer to
      // assume the boolean value was implicitly `true` and treat
      // the potential arg as a following option arg or positional value
      if (
        (potentialArg !== "true") && (potentialArg !== "false") &&
        this.currentOption!.type === ArgumentValueTypeName.BOOLEAN
      ) {
        // Set the value to implicit value of true and return ony error.
        if (!this.setOptionValue("true")) {
          return;
        }

        // Because of the implicit value, the current potential arg is either a new option arg or positional value
        // and it will be processed in the `ParseState.EMPTY` logic further below.
      } else {
        // Treat the potential arg as the value for the current option and set the value.
        this.setOptionValue(potentialArg);

        // Return regardless.
        return;
      }
    }
    // Now either expecting option argument (`--x`, `-x`, `--x=y`, `-x=y`, `--x.z[1]`, `--x.z[1]=y` etc.) or positional value next.
    if (this.state === ParseState.EMPTY) {
      // Look for an option argument first.
      if (potentialArg.startsWith("-")) {
        let potentialOptionPath = potentialArg;
        let potentialOptionValue;

        // check for option AND value
        if (potentialOptionPath.includes("=")) {
          [potentialOptionPath, potentialOptionValue] = potentialOptionPath
            .split(/=(.*)/);

          // check for illegal syntax e.g. --optionName=
          if (potentialOptionValue === "") {
            this.state = ParseState.ERROR;
            if (potentialOptionPath.startsWith("--")) {
              potentialOptionPath = potentialOptionPath.slice(2);
            } else {
              potentialOptionPath = potentialOptionPath.slice(1);
            }

            this.invalidArgument = {
              reason: InvalidArgumentReason.MISSING_VALUE,
              name: potentialOptionPath,
            };
            return;
          }
        }

        // Parse the option path and return if it failed
        if (!this.#parseOptionPath(potentialOptionPath)) {
          return;
        }

        // Check if the option path did refer to an option
        if (this.currentOption !== undefined) {
          // try to set the value if we have one
          if (potentialOptionValue !== undefined) {
            // set the value
            this.setOptionValue(potentialOptionValue);

            // return regardless
            return;
          }
          // otherwise we just got the option and the next arg will be a value
          return;
        }

        // As no option was found, in the logic below, the potential arg will be either assigned as a positional value or returned as unused.
      }

      // Not an option argument so try as positional value.
      if (this.currentPositionalIndex < this.subCommand.positionals.length) {
        // Treat the potential arg as the value for the current positional and set the value.
        this.setPositionalValue(potentialArg);

        // Return regardless of success or not.
        return;
      }

      // If neither option argument nor positional value so treat as unused.
      this.state = ParseState.UNUSED;
      return;
    }
    throw new Error(`Unexpected parse state: ${this.state}`);
  }
}

/**
 * Populate {@link PopulatedArgumentValues} for the provided {@link SubCommand} using the provided potential args.
 *
 * @param subCommand the {@link SubCommand} for which {@link PopulatedArgumentValues} values should be populated.
 * @param potentialArgs the potential args to use for population.
 * @param defaultValues optional default {@link ArgumentValues} to use for population before parsing the provided arguments.
 */
export default function populateSubCommandValues(
  subCommand: SubCommand,
  potentialArgs: ReadonlyArray<string>,
  defaultValues: PopulatedArgumentValues | undefined,
): SubCommandValuePopulationResult {
  logger.debug(() => {
    const message =
      `Populating values for sub-command: '${subCommand.name}' using potential args: ${
        potentialArgs.join(" ")
      }`;
    if (defaultValues !== undefined) {
      return `${message} and configured values: ${
        JSON.stringify(defaultValues)
      }`;
    }
    return message;
  });

  const parseContext = new ParseContext(subCommand);
  const unusedArgs: Array<string> = [];

  for (let i = 0; i < potentialArgs.length; i++) {
    const potentialArg = potentialArgs[i];

    // parse the next arg
    parseContext.parse(potentialArg);

    // check if we had a parsing error, record the error, flush the remaining args and stop parsing
    if (parseContext.state === ParseState.ERROR) {
      if (i + 1 < potentialArgs.length) {
        unusedArgs.push(...potentialArgs.slice(i + 1));
      }
      break;
    }
    // check if the arg was unused, save it and reset state for the next arg
    if (parseContext.state === ParseState.UNUSED) {
      unusedArgs.push(potentialArg);
      parseContext.state = ParseState.EMPTY;
    }
  }

  // Check if the last arg specified an option but no value
  if (parseContext.state === ParseState.OPTION_VALUE_EXPECTED) {
    // special case if the last arg was for a boolean option where the value was implicitly `true`
    if (parseContext.currentOption!.type === ArgumentValueTypeName.BOOLEAN) {
      parseContext.setOptionValue("true");
    } else {
      parseContext.invalidArgument = {
        argument: parseContext.currentOption,
        reason: InvalidArgumentReason.MISSING_VALUE,
        name: potentialArgs[potentialArgs.length - 1],
      };
    }
  }

  if (parseContext.invalidArgument) {
    return {
      populatedArgumentValues: parseContext.populatedArgumentValues,
      unusedArgs: unusedArgs,
      invalidArgument: parseContext.invalidArgument,
    };
  }

  // merge the configured values with the parsed values
  let populatedArgumentValues = parseContext.populatedArgumentValues;
  if (defaultValues) {
    populatedArgumentValues = argumentValueMerge(
      populatedArgumentValues,
      defaultValues,
    );
  }

  return {
    populatedArgumentValues,
    unusedArgs: unusedArgs,
  };
}
