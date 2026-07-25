import type {
  SingleValueType,
  Values,
  ValueType,
  PopulatedSingleValueType,
  PopulatedValues,
  PopulatedValueType,
} from "@flowscripter/dynamic-cli-framework-api";
import { ValueTypeName, ComplexValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { Positional } from "@flowscripter/dynamic-cli-framework-api";
import type { Option } from "@flowscripter/dynamic-cli-framework-api";
import type { ComplexOption } from "@flowscripter/dynamic-cli-framework-api";
import { isComplexOption } from "../argument/ArgumentTypeGuards.ts";
import type { InvalidArgument } from "@flowscripter/dynamic-cli-framework-api";
import { InvalidArgumentReason } from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
import type { Argument } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommand } from "@flowscripter/dynamic-cli-framework-api";

interface ValidationResult {
  invalidArgument?: InvalidArgument;
}

interface SingleValueValidationResult extends ValidationResult {
  validValue?: SingleValueType;
}

interface ArrayValueValidationResult extends ValidationResult {
  validValue?: Array<SingleValueType | Values>;
}

interface ObjectValueValidationResult extends ValidationResult {
  validValue?: Values;
}

/**
 * Validates the provided primitive value against the provided {@link Argument}.
 *
 * @param argument the {@link Argument} to validate against.
 * @param value the value (if any) for the {@link Argument}.
 */
function validatePrimitiveValue(
  argument: Argument,
  value: PopulatedSingleValueType,
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
    case ValueTypeName.BOOLEAN:
      if (value === true || value === false) {
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
    case ValueTypeName.INTEGER:
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
    case ValueTypeName.NUMBER:
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
    case ValueTypeName.STRING:
    default:
      convertedValue = String(value);
      break;
  }

  // check if the value is valid

  if (argument.allowableValues) {
    let searchValue = convertedValue;
    let allowableValues = argument.allowableValues;

    if (argument.type === ValueTypeName.STRING && argument.isCaseInsensitive) {
      searchValue = (convertedValue as string).toLowerCase();
      allowableValues = argument.allowableValues.map((v) => (v as string).toLowerCase());
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
    if ((convertedValue as number) < argument.minValueInclusive) {
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
    if ((convertedValue as number) > argument.maxValueInclusive) {
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
  arrayValue: Array<PopulatedSingleValueType | PopulatedValues | undefined>,
): ArrayValueValidationResult {
  const convertedArrayValue: Array<SingleValueType | Values> = [];

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

    let validationResult: SingleValueValidationResult | ObjectValueValidationResult;

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
      validationResult = validateObjectValue(subCommandArgument as ComplexOption, singleValue);
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
              validationResult.invalidArgument.name ? validationResult.invalidArgument.name : ""
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
              validationResult.invalidArgument.name ? validationResult.invalidArgument.name : ""
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
  objectValue: PopulatedValues,
): ObjectValueValidationResult {
  const convertedObjectValue: Values = {};

  for (let i = 0; i < argument.properties.length; i++) {
    const propertyArg = argument.properties[i]!;
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
      validationResult = validateArrayValue(
        propertyArg as ComplexOption | SubCommandArgument,
        propertyValue,
      );
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
        propertyValue as PopulatedValues,
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
      validationResult = validatePrimitiveValue(propertyArg as SubCommandArgument, propertyValue);
    }
    if (validationResult.validValue !== undefined) {
      convertedObjectValue[propertyArg.name] = validationResult.validValue as
        | ValueType
        | Values
        | Array<Values>;
    }
    // fast fail
    if (validationResult.invalidArgument !== undefined) {
      if (validationResult.invalidArgument.value !== undefined) {
        return {
          validValue: convertedObjectValue,
          invalidArgument: {
            argument: validationResult.invalidArgument.argument,
            name: `.${propertyArg.name}${
              validationResult.invalidArgument.name ? validationResult.invalidArgument.name : ""
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
              validationResult.invalidArgument.name ? validationResult.invalidArgument.name : ""
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
  value: PopulatedValueType | PopulatedValues | Array<PopulatedValues | undefined>,
  isArray: boolean,
  isOptional: boolean,
  invalidArguments: Array<InvalidArgument>,
): PopulatedValueType | PopulatedValues | Array<PopulatedValues> {
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
      validationResult = validatePrimitiveValue(argument as SubCommandArgument, value);
    }

    if (validationResult.invalidArgument !== undefined) {
      if (validationResult.invalidArgument.value !== undefined) {
        validationResult.invalidArgument = {
          argument: validationResult.invalidArgument.argument,
          name: `${argument.name}${
            validationResult.invalidArgument.name ? validationResult.invalidArgument.name : ""
          }`,
          value: validationResult.invalidArgument.value,
          reason: validationResult.invalidArgument.reason,
        };
      } else {
        validationResult.invalidArgument = {
          argument: validationResult.invalidArgument.argument,
          name: `${argument.name}${
            validationResult.invalidArgument.name ? validationResult.invalidArgument.name : ""
          }`,
          reason: validationResult.invalidArgument.reason,
        };
      }
    }

    if (validationResult.invalidArgument) {
      invalidArguments.push(validationResult.invalidArgument);
      return undefined;
    }
    if (argument.validate && validationResult.validValue !== undefined) {
      const customError = argument.validate(
        validationResult.validValue as ValueType | Values | Array<Values>,
      );
      if (customError !== undefined) {
        invalidArguments.push({
          argument,
          name: argument.name,
          value: validationResult.validValue as PopulatedValueType,
          reason: InvalidArgumentReason.CUSTOM_VALIDATION,
          message: customError,
        });
        return undefined;
      }
    }
    return validationResult.validValue as PopulatedValueType | PopulatedValues | undefined;
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
  value: PopulatedValueType | PopulatedValues | Array<PopulatedValues | undefined>,
  invalidArguments: Array<InvalidArgument>,
): PopulatedValueType | PopulatedValues | Array<PopulatedValues> {
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
  value: PopulatedValueType,
  invalidArguments: Array<InvalidArgument>,
): PopulatedValueType {
  return doSubCommandArgumentValidation(
    positional,
    value,
    positional.isVarargMultiple || false,
    positional.isVarargOptional || false,
    invalidArguments,
  ) as PopulatedValueType;
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
  value: PopulatedSingleValueType,
  invalidArguments: Array<InvalidArgument>,
): PopulatedSingleValueType {
  // if this function is called it is because the argument is defined
  const globalCommandArgument = globalCommand.argument!;

  // if there is a value, check if it is valid
  if (value !== undefined) {
    const validationResult = validatePrimitiveValue(globalCommandArgument, value);

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

    if (globalCommandArgument.validate && validationResult.validValue !== undefined) {
      const customError = globalCommandArgument.validate(validationResult.validValue as ValueType);
      if (customError !== undefined) {
        invalidArguments.push({
          argument: globalCommandArgument,
          name: globalCommand.name,
          value: validationResult.validValue,
          reason: InvalidArgumentReason.CUSTOM_VALIDATION,
          message: customError,
        });
        return undefined;
      }
    }
    return validationResult.validValue as PopulatedSingleValueType;
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
  if (!skipArgName && invalidArgument.name !== undefined) {
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
    case InvalidArgumentReason.CUSTOM_VALIDATION:
      invalidString = invalidArgument.message
        ? `(custom validation: ${invalidArgument.message})`
        : "(custom validation failed)";
      break;
    default:
      invalidString = "";
      break;
  }
  return `${argString}${invalidString}`;
}
