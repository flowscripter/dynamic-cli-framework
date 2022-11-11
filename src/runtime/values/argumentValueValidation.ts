import GlobalCommandArgument from "../../api/argument/GlobalCommandArgument.ts";
import {
  InvalidArgument,
  InvalidArgumentReason,
} from "../../api/runtime/Parser.ts";
import {
  ArgumentSingleValueType,
  ArgumentValues,
  ArgumentValueType,
  ArgumentValueTypeName,
  ComplexValueTypeName,
  PopulatedArgumentSingleValueType,
  PopulatedArgumentValues,
  PopulatedArgumentValueType,
} from "../../api/argument/ArgumentValueTypes.ts";
import Positional from "../../api/argument/Positional.ts";
import Option from "../../api/argument/Option.ts";
import Argument from "../../api/argument/Argument.ts";
import ComplexOption from "../../api/argument/ComplexOption.ts";
import { isComplexOption } from "../../api/argument/ArgumentTypeGuards.ts";

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
        reason: InvalidArgumentReason.MISSING_VALUE,
      },
    };
  }

  // type check and conversion
  switch (argument.type) {
    case ArgumentValueTypeName.BOOLEAN:
      if (value !== "true" && value !== "false") {
        return {
          invalidArgument: {
            value,
            reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
          },
        };
      }
      convertedValue = value === "true";
      break;
    case ArgumentValueTypeName.INTEGER:
      if (!Number.isInteger(Number(value))) {
        return {
          invalidArgument: {
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
  if (argument.validValues && !argument.validValues.includes(value)) {
    return {
      invalidArgument: {
        value,
        reason: InvalidArgumentReason.ILLEGAL_VALUE,
      },
    };
  }
  return { validValue: convertedValue };
}

function validateArrayValue(
  argument: Argument | ComplexOption,
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
        `Unexpected array value as array member, arrays of arrays are not supported. Arg name: ${argument.name}[${i}]`,
      );
    } else if (typeof singleValue === "object") {
      if (argument.type !== ComplexValueTypeName.COMPLEX) {
        return {
          validValue: convertedArrayValue,
          invalidArgument: {
            name: `[${i}]`,
            value: arrayValue,
            reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
          },
        };
      }
      validationResult = validateObjectValue(
        argument as ComplexOption,
        singleValue,
      );
    } // if not array and not object, then must be primitive
    else {
      validationResult = validatePrimitiveValue(
        argument as Argument,
        singleValue,
      );
    }

    if (validationResult.validValue !== undefined) {
      convertedArrayValue.push(validationResult.validValue);
    }
    if (validationResult.invalidArgument !== undefined) {
      // fast fail
      if (validationResult.invalidArgument.value !== undefined) {
        return {
          validValue: convertedArrayValue,
          invalidArgument: {
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
      validationResult = validatePrimitiveValue(
        propertyArg as Argument,
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

function doValidation(
  argument: Argument | ComplexOption,
  value:
    | PopulatedArgumentValueType
    | PopulatedArgumentValues
    | Array<PopulatedArgumentValues | undefined>,
  isArray: boolean,
  isOptional: boolean,
  invalidArguments: InvalidArgument[],
): ArgumentValueType | ArgumentValues | Array<ArgumentValues> | undefined {
  // if there is a value, check if it is valid
  if (value !== undefined) {
    let validationResult;

    if (Array.isArray(value)) {
      if (!isArray) {
        invalidArguments.push({
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
          name: argument.name,
          value,
          reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
        });
        return undefined;
      }
      validationResult = validatePrimitiveValue(argument as Argument, value);
    }

    if (validationResult.invalidArgument !== undefined) {
      if (validationResult.invalidArgument.value !== undefined) {
        validationResult.invalidArgument = {
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
      | ArgumentValueType
      | ArgumentValues
      | undefined;
  }

  // if there is no value, check if it was optional
  if (!isOptional) {
    invalidArguments.push({
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
): ArgumentValueType | ArgumentValues | Array<ArgumentValues> | undefined {
  return doValidation(
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
): ArgumentValueType | undefined {
  return doValidation(
    positional,
    value,
    positional.isVarargMultiple || false,
    positional.isVarargOptional || false,
    invalidArguments,
  ) as ArgumentValueType | undefined;
}

/**
 * Validates the provided value against the provided {@link GlobalCommandArgument} and returns the validated
 * value or undefined if the value was invalid.
 *
 * @param globalCommandArgument the {@link GlobalCommandArgument} to validate against.
 * @param value the value (if any) for the {@link GlobalCommandArgument}.
 * @param invalidArguments an array of {@link InvalidArgument} which may be added to if the provided value is invalid.
 */
export function validateGlobalCommandArgumentValue(
  globalCommandArgument: GlobalCommandArgument,
  value: PopulatedArgumentValueType,
  invalidArguments: Array<InvalidArgument>,
): ArgumentValueType | undefined {
  return doValidation(
    globalCommandArgument,
    value,
    false,
    globalCommandArgument.isOptional || false,
    invalidArguments,
  ) as ArgumentValueType | undefined;
}
