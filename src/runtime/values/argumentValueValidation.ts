import type {
  ArgumentSingleValueType,
  ArgumentValues,
  ArgumentValueType,
  PopulatedArgumentSingleValueType,
  PopulatedArgumentValues,
  PopulatedArgumentValueType,
} from "../../api/argument/ArgumentValueTypes.ts";
import {
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "../../api/argument/ArgumentValueTypes.ts";
import type Positional from "../../api/argument/Positional.ts";
import type Option from "../../api/argument/Option.ts";
import type ComplexOption from "../../api/argument/ComplexOption.ts";
import { isComplexOption } from "../argument/ArgumentTypeGuards.ts";
import type { InvalidArgument } from "../../api/RunResult.ts";
import { InvalidArgumentReason } from "../../api/RunResult.ts";
import type SubCommandArgument from "../../api/argument/SubCommandArgument.ts";
import type Argument from "../../api/argument/Argument.ts";
import type GlobalCommand from "../../api/command/GlobalCommand.ts";

interface ValidationResult {
  invalidArgument?: InvalidArgument;
}

interface SingleValueValidationResult extends ValidationResult {
  validValue?: ArgumentSingleValueType;
}

interface ArrayValueValidationResult extends ValidationResult {
  validValue?: Array<ArgumentSingleValueType | ArgumentValues>;
}

interface ObjectValueValidationResult extends ValidationResult {
  validValue?: ArgumentValues;
}

/**
 * Validates the provided primitive value against the provided {@link Argument}.
 *
 * @param argument the {@link Argument} to validate against.
 * @param value the value (if any) for the {@link Argument}.
 */
function validatePrimitiveValue(
  argument: Argument,
  value: PopulatedArgumentSingleValueType,
): SingleValueValidationResult {
  let convertedValue;

  if (value === undefined) {
    return {
      invalidArgument: {
        argument,
        reason: InvalidArgumentReason.MISSING_VALUE,
      },
    };
  }

  // type check and conversion
  let castValue: string | undefined;
  switch (argument.type) {
    case ArgumentValueTypeName.BOOLEAN:
      if ((value === true) || (value === false)) {
        convertedValue = value;
        break;
      }
      if (typeof value === "string") {
        castValue = value as string;
        castValue = castValue.toLowerCase();
      }
      if (castValue !== "true" && castValue !== "false") {
        return {
          invalidArgument: {
            argument,
            value,
            reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
          },
        };
      }
      convertedValue = castValue === "true";
      break;
    case ArgumentValueTypeName.INTEGER:
      if (!Number.isInteger(Number(value))) {
        return {
          invalidArgument: {
            argument,
            value,
            reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
          },
        };
      }
      convertedValue = Number(value);
      break;
    case ArgumentValueTypeName.NUMBER:
      if (!Number.isFinite(Number(value))) {
        return {
          invalidArgument: {
            argument,
            value,
            reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
          },
        };
      }
      convertedValue = Number(value);
      break;
    case ArgumentValueTypeName.STRING:
    default:
      convertedValue = String(value);
      break;
  }

  // check if the value is valid

  if (argument.allowableValues) {
    let searchValue = convertedValue;
    let allowableValues = argument.allowableValues;

    if (
      (argument.type === ArgumentValueTypeName.STRING) &&
      argument.isCaseInsensitive
    ) {
      searchValue = convertedValue.toLowerCase();
      allowableValues = argument.allowableValues.map((v) =>
        (v as string).toLowerCase()
      );
    }
    if (!allowableValues.includes(searchValue)) {
      return {
        invalidArgument: {
          argument,
          value,
          reason: InvalidArgumentReason.ILLEGAL_VALUE,
        },
      };
    }
  }
  if (argument.minValueInclusive !== undefined) {
    if (convertedValue < argument.minValueInclusive) {
      return {
        invalidArgument: {
          argument,
          value,
          reason: InvalidArgumentReason.ILLEGAL_VALUE,
        },
      };
    }
  }

  if (argument.maxValueInclusive !== undefined) {
    if (convertedValue > argument.maxValueInclusive) {
      return {
        invalidArgument: {
          argument,
          value,
          reason: InvalidArgumentReason.ILLEGAL_VALUE,
        },
      };
    }
  }

  return { validValue: convertedValue };
}

function validateArrayValue(
  subCommandArgument: SubCommandArgument | ComplexOption,
  arrayValue: Array<
    PopulatedArgumentSingleValueType | PopulatedArgumentValues | undefined
  >,
): ArrayValueValidationResult {
  const convertedArrayValue: Array<ArgumentSingleValueType | ArgumentValues> =
    [];

  for (let i = 0; i < arrayValue.length; i += 1) {
    const singleValue = arrayValue[i];

    if (singleValue === undefined) {
      return {
        validValue: convertedArrayValue,
        invalidArgument: {
          argument: subCommandArgument,
          name: `[${i}]`,
          reason: InvalidArgumentReason.ILLEGAL_SPARSE_ARRAY,
        },
      };
    }

    let validationResult:
      | SingleValueValidationResult
      | ObjectValueValidationResult;

    if (Array.isArray(singleValue)) {
      throw new Error(
        `Unexpected array value as array member, arrays of arrays are not supported. Argument: ${subCommandArgument.name}[${i}]`,
      );
    } else if (typeof singleValue === "object") {
      if (subCommandArgument.type !== ComplexValueTypeName.COMPLEX) {
        return {
          validValue: convertedArrayValue,
          invalidArgument: {
            argument: subCommandArgument,
            name: `[${i}]`,
            value: arrayValue,
            reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
          },
        };
      }
      validationResult = validateObjectValue(
        subCommandArgument as ComplexOption,
        singleValue,
      );
    } // if not array and not object, then must be primitive
    else {
      if (isComplexOption(subCommandArgument)) {
        return {
          validValue: convertedArrayValue,
          invalidArgument: {
            argument: subCommandArgument,
            name: `[${i}]`,
            value: arrayValue,
            reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
          },
        };
      }
      validationResult = validatePrimitiveValue(
        subCommandArgument as SubCommandArgument,
        singleValue,
      );
    }

    if (validationResult.validValue !== undefined) {
      convertedArrayValue.push(validationResult.validValue);
    }
    if (validationResult.invalidArgument) {
      // fast fail
      if (validationResult.invalidArgument.value !== undefined) {
        return {
          validValue: convertedArrayValue,
          invalidArgument: {
            argument: validationResult.invalidArgument.argument,
            name: `[${i}]${
              validationResult.invalidArgument.name
                ? validationResult.invalidArgument.name
                : ""
            }`,
            value: validationResult.invalidArgument.value,
            reason: validationResult.invalidArgument.reason,
          },
        };
      } else {
        return {
          validValue: convertedArrayValue,
          invalidArgument: {
            argument: validationResult.invalidArgument.argument,
            name: `[${i}]${
              validationResult.invalidArgument.name
                ? validationResult.invalidArgument.name
                : ""
            }`,
            reason: validationResult.invalidArgument.reason,
          },
        };
      }
    }
  }
  return {
    validValue: convertedArrayValue,
  };
}

function validateObjectValue(
  argument: ComplexOption,
  objectValue: PopulatedArgumentValues,
): ObjectValueValidationResult {
  const convertedObjectValue: ArgumentValues = {};

  for (let i = 0; i < argument.properties.length; i++) {
    const propertyArg = argument.properties[i];
    const propertyValue = objectValue[propertyArg.name];

    if (propertyValue === undefined) {
      return {
        validValue: convertedObjectValue,
        invalidArgument: {
          argument: propertyArg,
          name: `.${propertyArg.name}`,
          reason: InvalidArgumentReason.MISSING_VALUE,
        },
      };
    }

    let validationResult:
      | SingleValueValidationResult
      | ObjectValueValidationResult
      | ArrayValueValidationResult;

    if (Array.isArray(propertyValue)) {
      if (!propertyArg.isArray) {
        return {
          validValue: convertedObjectValue,
          invalidArgument: {
            argument: propertyArg,
            name: `.${propertyArg.name}`,
            value: propertyValue,
            reason: InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES,
          },
        };
      }
      validationResult = validateArrayValue(propertyArg, propertyValue);
    } else if (typeof propertyValue === "object") {
      if (propertyArg.type !== ComplexValueTypeName.COMPLEX) {
        return {
          validValue: convertedObjectValue,
          invalidArgument: {
            argument: propertyArg,
            name: `.${propertyArg.name}`,
            value: propertyValue,
            reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
          },
        };
      }
      validationResult = validateObjectValue(
        propertyArg as ComplexOption,
        propertyValue as PopulatedArgumentValues,
      );
    } // if not array and not object, then must be primitive
    else {
      if (isComplexOption(propertyArg)) {
        return {
          validValue: convertedObjectValue,
          invalidArgument: {
            argument: propertyArg,
            name: `.${propertyArg.name}`,
            value: propertyValue,
            reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
          },
        };
      }
      validationResult = validatePrimitiveValue(
        propertyArg as SubCommandArgument,
        propertyValue,
      );
    }
    if (validationResult.validValue !== undefined) {
      convertedObjectValue[propertyArg.name] = validationResult.validValue as
        | ArgumentValueType
        | ArgumentValues
        | Array<ArgumentValues>;
    }
    // fast fail
    if (validationResult.invalidArgument !== undefined) {
      if (validationResult.invalidArgument.value !== undefined) {
        return {
          validValue: convertedObjectValue,
          invalidArgument: {
            argument: validationResult.invalidArgument.argument,
            name: `.${propertyArg.name}${
              validationResult.invalidArgument.name
                ? validationResult.invalidArgument.name
                : ""
            }`,
            value: validationResult.invalidArgument.value,
            reason: validationResult.invalidArgument.reason,
          },
        };
      } else {
        return {
          validValue: convertedObjectValue,
          invalidArgument: {
            argument: validationResult.invalidArgument.argument,
            name: `.${propertyArg.name}${
              validationResult.invalidArgument.name
                ? validationResult.invalidArgument.name
                : ""
            }`,
            reason: validationResult.invalidArgument.reason,
          },
        };
      }
    }
  }
  return {
    validValue: convertedObjectValue,
  };
}

function doSubCommandArgumentValidation(
  argument: SubCommandArgument | ComplexOption,
  value:
    | PopulatedArgumentValueType
    | PopulatedArgumentValues
    | Array<PopulatedArgumentValues | undefined>,
  isArray: boolean,
  isOptional: boolean,
  invalidArguments: Array<InvalidArgument>,
):
  | PopulatedArgumentValueType
  | PopulatedArgumentValues
  | Array<PopulatedArgumentValues> {
  // if there is a value, check if it is valid
  if (value !== undefined) {
    let validationResult;

    if (Array.isArray(value)) {
      if (!isArray) {
        invalidArguments.push({
          argument,
          name: argument.name,
          value,
          reason: InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES,
        });
        return undefined;
      }
      validationResult = validateArrayValue(argument, value);
    } else if (typeof value === "object") {
      if (!isComplexOption(argument)) {
        invalidArguments.push({
          argument,
          name: argument.name,
          value,
          reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
        });
        return undefined;
      }
      validationResult = validateObjectValue(argument, value);
    } else {
      if (isComplexOption(argument)) {
        invalidArguments.push({
          argument,
          name: argument.name,
          value,
          reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
        });
        return undefined;
      }
      validationResult = validatePrimitiveValue(
        argument as SubCommandArgument,
        value,
      );
    }

    if (validationResult.invalidArgument !== undefined) {
      if (validationResult.invalidArgument.value !== undefined) {
        validationResult.invalidArgument = {
          argument: validationResult.invalidArgument.argument,
          name: `${argument.name}${
            validationResult.invalidArgument.name
              ? validationResult.invalidArgument.name
              : ""
          }`,
          value: validationResult.invalidArgument.value,
          reason: validationResult.invalidArgument.reason,
        };
      } else {
        validationResult.invalidArgument = {
          argument: validationResult.invalidArgument.argument,
          name: `${argument.name}${
            validationResult.invalidArgument.name
              ? validationResult.invalidArgument.name
              : ""
          }`,
          reason: validationResult.invalidArgument.reason,
        };
      }
    }

    if (validationResult.invalidArgument) {
      invalidArguments.push(validationResult.invalidArgument);
      return undefined;
    }
    return validationResult.validValue as
      | PopulatedArgumentValueType
      | PopulatedArgumentValues
      | undefined;
  }

  // if there is no value, check if it was optional
  if (!isOptional) {
    invalidArguments.push({
      argument: argument,
      name: argument.name,
      reason: InvalidArgumentReason.MISSING_VALUE,
    });
  }
  return undefined;
}

/**
 * Validates the provided value against the provided {@link Option}.
 *
 * @param option the {@link Option} to validate against.
 * @param value the value (if any) for the {@link Option}.
 * @param invalidArguments an array of {@link InvalidArgument} which may be added to if the provided value is invalid.
 */
export function validateOptionValue(
  option: Option | ComplexOption,
  value:
    | PopulatedArgumentValueType
    | PopulatedArgumentValues
    | Array<PopulatedArgumentValues | undefined>,
  invalidArguments: Array<InvalidArgument>,
):
  | PopulatedArgumentValueType
  | PopulatedArgumentValues
  | Array<PopulatedArgumentValues> {
  return doSubCommandArgumentValidation(
    option,
    value,
    option.isArray || false,
    option.isOptional || false,
    invalidArguments,
  );
}

/**
 * Validates the provided value against the provided {@link Positional}.
 *
 * @param positional the {@link Positional} to validate against.
 * @param value the value (if any) for the {@link Positional}.
 * @param invalidArguments an array of {@link InvalidArgument} which may be added to if the provided value is invalid.
 */
export function validatePositionalValue(
  positional: Positional,
  value: PopulatedArgumentValueType,
  invalidArguments: Array<InvalidArgument>,
): PopulatedArgumentValueType {
  return doSubCommandArgumentValidation(
    positional,
    value,
    positional.isVarargMultiple || false,
    positional.isVarargOptional || false,
    invalidArguments,
  ) as PopulatedArgumentValueType;
}

/**
 * Validates the provided value against the {@link GlobalCommandArgument} provided by the {@link GlobalCommand} and returns the validated
 * value or undefined if the value was invalid.
 *
 * @param globalCommand the {@link GlobalCommand} providing the {@link GlobalCommandArgument}.
 * @param value the value (if any) for the {@link GlobalCommandArgument}.
 * @param invalidArguments an array of {@link InvalidArgument} which may be added to if the provided value is invalid.
 */
export function validateGlobalCommandArgumentValue(
  globalCommand: GlobalCommand,
  value: PopulatedArgumentSingleValueType,
  invalidArguments: Array<InvalidArgument>,
): PopulatedArgumentSingleValueType {
  // if this function is called it is because the argument is defined
  const globalCommandArgument = globalCommand.argument!;

  // if there is a value, check if it is valid
  if (value !== undefined) {
    const validationResult = validatePrimitiveValue(
      globalCommandArgument,
      value,
    );

    if (validationResult.invalidArgument) {
      if (validationResult.invalidArgument.value !== undefined) {
        invalidArguments.push({
          argument: globalCommandArgument,
          name: globalCommand.name,
          value: validationResult.invalidArgument.value,
          reason: validationResult.invalidArgument.reason,
        });
      } else {
        invalidArguments.push({
          argument: globalCommandArgument,
          name: globalCommand.name,
          reason: validationResult.invalidArgument.reason,
        });
      }
      return undefined;
    }

    return validationResult.validValue as PopulatedArgumentSingleValueType;
  }

  // if there is no value, check if it was optional
  if (!globalCommandArgument.isOptional) {
    invalidArguments.push({
      argument: globalCommandArgument,
      name: globalCommand.name,
      reason: InvalidArgumentReason.MISSING_VALUE,
    });
  }
  return undefined;
}

export function getInvalidArgumentString(
  invalidArgument: InvalidArgument,
  skipArgName: boolean,
): string {
  let nameString = "";
  if (!skipArgName && (invalidArgument.name !== undefined)) {
    nameString = invalidArgument.name;
  }
  let valueString = "";
  if (invalidArgument.value !== undefined) {
    valueString = `'${invalidArgument.value}'`;
  }
  let argString = "";
  if (nameString !== "") {
    if (valueString !== "") {
      argString = `${nameString}=${valueString} `;
    } else {
      argString = `${nameString} `;
    }
  } else if (valueString !== "") {
    argString = `${valueString} `;
  }

  let invalidString;

  switch (invalidArgument.reason) {
    case InvalidArgumentReason.MISSING_VALUE:
      invalidString = "(missing value)";
      break;
    case InvalidArgumentReason.INCORRECT_VALUE_TYPE:
      invalidString = "(incorrect type)";
      break;
    case InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES:
      invalidString = "(illegal multiple values)";
      break;
    case InvalidArgumentReason.ILLEGAL_VALUE:
      invalidString = "(illegal value)";
      break;
    case InvalidArgumentReason.ILLEGAL_SPARSE_ARRAY:
      invalidString = "(sparse array values)";
      break;
    case InvalidArgumentReason.UNKNOWN_PROPERTY:
      invalidString = "(unknown property)";
      break;
    case InvalidArgumentReason.NESTING_DEPTH_EXCEEDED:
      invalidString = "(nesting depth exceeded)";
      break;
    case InvalidArgumentReason.ARRAY_SIZE_EXCEEDED:
      invalidString = "(array size exceeded)";
      break;
    case InvalidArgumentReason.OPTION_IS_COMPLEX:
      invalidString = "(specified option is complex)";
      break;
    default:
      invalidString = "";
      break;
  }
  return `${argString}${invalidString}`;
}
