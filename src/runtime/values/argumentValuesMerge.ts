import {
  ArgumentSingleValueType,
  ArgumentValues,
  PopulatedArgumentSingleValueType,
  PopulatedArgumentValues,
  PopulatedArgumentValueType,
} from "../../api/argument/ArgumentValueTypes.ts";

function doClone(
  source:
    | PopulatedArgumentValueType
    | PopulatedArgumentValues
    | Array<PopulatedArgumentValues | undefined>
    | Array<PopulatedArgumentSingleValueType>,
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
    return arrayMerge(source, []);
  }
  // check if source is an object
  if (typeof source === "object") {
    return objectMerge(source, {});
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
): Array<PopulatedArgumentSingleValueType> | Array<PopulatedArgumentValues> {
  const result = base.slice();

  override.forEach((argValue, index) => {
    if (Array.isArray(argValue)) {
      throw new Error(
        `Arrays of array values discovered, this is not supported: ${
          JSON.stringify(argValue)
        }`,
      );
    }
    if (index >= base.length) {
      result.push(
        doClone(argValue) as
          & PopulatedArgumentSingleValueType
          & PopulatedArgumentValues,
      );
    } else {
      result[index] = doMerge(argValue, base[index]) as
        | PopulatedArgumentSingleValueType
        | PopulatedArgumentValues;
    }
  });
  return result;
}

function objectMerge(
  override: PopulatedArgumentValues,
  base: PopulatedArgumentValues,
): PopulatedArgumentValues {
  const result: PopulatedArgumentValues = {};

  Object.keys(override).forEach((argName) => {
    if (base[argName] === undefined) {
      // nothing to merge so just clone the override
      result[argName] = doClone(override[argName]);
    } else {
      // merge the base and the override
      result[argName] = doMerge(override[argName], base[argName]);
    }
  });
  Object.keys(base).forEach((argName) => {
    // if the base is in the override, we have already merged above
    if (override[argName] !== undefined) {
      return;
    }
    // nothing to merge so just clone the base
    result[argName] = doClone(base[argName]);
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
    );
  }
  // check if override is an object
  if (typeof override === "object") {
    return objectMerge(override, defaults as ArgumentValues);
  }

  // check if override is undefined so we should use default
  if (override === undefined) {
    return doClone(defaults);
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
export default function argumentValuesMerge(
  override: PopulatedArgumentValues,
  defaults: ArgumentValues,
): PopulatedArgumentValues {
  return doMerge(override, defaults) as PopulatedArgumentValues;
}
