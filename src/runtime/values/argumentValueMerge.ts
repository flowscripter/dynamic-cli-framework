import type {
  ArgumentSingleValueType,
  ArgumentValues,
  PopulatedArgumentSingleValueType,
  PopulatedArgumentValues,
  PopulatedArgumentValueType,
} from "../../api/argument/ArgumentValueTypes.ts";
import { MAXIMUM_ARGUMENT_ARRAY_SIZE } from "../../api/argument/SubCommandArgument.ts";
import { MAXIMUM_COMPLEX_OPTION_NESTING_DEPTH } from "../../api/argument/ComplexOption.ts";

function doClone(
  source:
    | PopulatedArgumentValueType
    | PopulatedArgumentValues
    | Array<PopulatedArgumentValues | undefined>
    | Array<PopulatedArgumentSingleValueType>,
  nestingLevel: number,
):
  | PopulatedArgumentValueType
  | PopulatedArgumentValues
  | Array<PopulatedArgumentValues>
  | Array<PopulatedArgumentSingleValueType> {
  if (source === undefined) {
    return source;
  }
  // check if source is an array
  if (Array.isArray(source)) {
    return arrayMerge(source, [], nestingLevel);
  }
  // check if source is an object
  if (typeof source === "object") {
    return objectMerge(source, {}, nestingLevel);
  }
  // source must be a primitive value
  return source;
}

function arrayMerge(
  override:
    | Array<PopulatedArgumentSingleValueType>
    | Array<PopulatedArgumentValues | undefined>,
  base:
    | Array<PopulatedArgumentSingleValueType>
    | Array<PopulatedArgumentValues>,
  nestingLevel: number,
): Array<PopulatedArgumentSingleValueType> | Array<PopulatedArgumentValues> {
  if (override.length > MAXIMUM_ARGUMENT_ARRAY_SIZE) {
    throw new Error(`Maximum array size exceeded: ${override.length}`);
  }
  if (base.length > MAXIMUM_ARGUMENT_ARRAY_SIZE) {
    throw new Error(`Maximum array size exceeded: ${override.length}`);
  }
  const result = base.slice();

  override.forEach((argValue, index) => {
    if (Array.isArray(argValue)) {
      throw new Error(
        `Array of array values discovered, this is not supported: ${
          JSON.stringify(argValue)
        }`,
      );
    }
    if (index >= base.length) {
      result.push(
        doClone(argValue, nestingLevel) as
          & PopulatedArgumentSingleValueType
          & PopulatedArgumentValues,
      );
    } else {
      result[index] = doMerge(argValue, base[index], nestingLevel) as
        | PopulatedArgumentSingleValueType
        | PopulatedArgumentValues;
    }
  });
  return result;
}

function objectMerge(
  override: PopulatedArgumentValues,
  base: PopulatedArgumentValues,
  nestingLevel: number,
): PopulatedArgumentValues {
  if (nestingLevel > MAXIMUM_COMPLEX_OPTION_NESTING_DEPTH) {
    throw new Error(
      `Maximum complex option nesting depth exceeded: ${nestingLevel}`,
    );
  }

  nestingLevel++;

  const result: PopulatedArgumentValues = {};

  Object.keys(override).forEach((argName) => {
    if (base[argName] === undefined) {
      // nothing to merge so just clone the override
      result[argName] = doClone(override[argName], nestingLevel);
    } else {
      // merge the base and the override
      result[argName] = doMerge(override[argName], base[argName], nestingLevel);
    }
  });
  Object.keys(base).forEach((argName) => {
    // if the base is in the override, we have already merged above
    if (override[argName] !== undefined) {
      return;
    }
    // nothing to merge so just clone the base
    result[argName] = doClone(base[argName], nestingLevel);
  });
  return result;
}

function doMerge(
  override:
    | PopulatedArgumentValues
    | PopulatedArgumentValueType
    | Array<PopulatedArgumentValues | undefined>,
  defaults:
    | PopulatedArgumentValues
    | PopulatedArgumentValueType
    | Array<PopulatedArgumentValues | undefined>,
  nestingLevel: number,
):
  | PopulatedArgumentValues
  | PopulatedArgumentValueType
  | Array<PopulatedArgumentValues> {
  if (defaults === undefined) {
    throw new Error(
      `Undefined value provided in merge: override = ${
        JSON.stringify(override)
      }, defaults = undefined`,
    );
  }
  if (typeof override !== typeof defaults) {
    // check if we need to convert from single value to array
    if (Array.isArray(override)) {
      if (typeof defaults === "object") {
        defaults = [defaults as ArgumentValues];
      } else {
        defaults = [defaults as ArgumentSingleValueType];
      }
    } else if (Array.isArray(defaults)) {
      if (typeof override === "object") {
        override = [override as PopulatedArgumentValues];
      } else {
        override = [override as PopulatedArgumentSingleValueType];
      }
    } // check if we need to convert from single non-string value to single string value
    else if (
      (typeof override === "string") &&
      ((typeof defaults == "number") || (typeof defaults == "boolean"))
    ) {
      defaults = `${defaults}`;
    }
  }
  if (override !== undefined && (typeof override !== typeof defaults)) {
    throw new Error(
      `Incompatible value types provided in merge: override = ${
        JSON.stringify(override)
      }, defaults = ${JSON.stringify(defaults)}`,
    );
  }

  // check if override is an array
  if (Array.isArray(override)) {
    return arrayMerge(
      override,
      defaults as Array<ArgumentValues> | Array<ArgumentSingleValueType>,
      nestingLevel,
    );
  }
  // check if override is an object
  if (typeof override === "object") {
    return objectMerge(override, defaults as ArgumentValues, nestingLevel);
  }

  // check if override is undefined so we should use default
  if (override === undefined) {
    return doClone(defaults, nestingLevel);
  }

  // override must be a primitive value
  return override;
}

/**
 * Deep merge of provided default argument values with overridden argument values. The result is a cloned instance
 * of `defaults` with values in `override` cloned and merged in the result.
 *
 * @throws {Error} if a value appears under the same argument name in both `override` and `defaults`.
 * and they are not of the same type, or if either argument is `undefined`.
 *
 * @param override the values which should be used in place of any defined in `defaults`.
 * @param defaults the values to use unless they are overridden in `override`.
 */
export default function argumentValueMerge(
  override: PopulatedArgumentValues,
  defaults: PopulatedArgumentValues,
): PopulatedArgumentValues {
  return doMerge(override, defaults, 0) as PopulatedArgumentValues;
}
