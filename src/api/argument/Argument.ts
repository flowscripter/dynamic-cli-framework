import type {
  ArgumentSingleValueType,
  ArgumentValues,
  ArgumentValueType,
  ArgumentValueTypeName,
} from "./ArgumentValueTypes.ts";

/**
 * Interface to be implemented by all {@link Command} arguments.
 */
export default interface Argument {
  /**
   * Type of the argument value.
   */
  readonly type: ArgumentValueTypeName;

  /**
   * Optional list of values that the value must match. This is not supported for {@link ArgumentValueTypeName.BOOLEAN}.
   */
  readonly allowableValues?: ReadonlyArray<ArgumentSingleValueType>;

  /**
   * Optional (default is `false`) for {@link ArgumentValueTypeName.STRING} when comparing a value against {@link allowableValues}.
   */
  readonly isCaseInsensitive?: boolean;

  /**
   * Optional for {@link ArgumentValueTypeName.INTEGER} or {@link ArgumentValueTypeName.NUMBER} when validating a value.
   */
  readonly minValueInclusive?: number;

  /**
   * Optional for {@link ArgumentValueTypeName.INTEGER} or {@link ArgumentValueTypeName.NUMBER} when validating a value.
   */
  readonly maxValueInclusive?: number;

  /**
   * Optional configuration key to use for the argument. Must consist of alphanumeric non-whitespace uppercase
   * ASCII or `_` characters. Must not start with a digit.
   *
   * If not specified a default configuration key is determined as follows: The {@link Argument.name} is capitalized
   * and any `-` characters are replaced with `_` characters. If the result starts with a digit, it is
   * prefixed with `_`. Some examples:
   *
   * * name: `FooBar` => configuration key: `FOOBAR`
   * * name: `Hello-World-` => configuration key: `HELLO_WORLD_`
   * * name: `3` => configuration key: `_3`
   *
   * NOTE: Regardless of whether a {@link configurationKey} is specified, or the default is relied upon,
   * it will only be used if the parent {@link Command} has specified {@link Command.enableConfiguration} as `true`.
   */
  readonly configurationKey?: string;

  /**
   * Optional custom validation function invoked after all built-in validation
   * has passed. Receives the validated and type-converted value.
   *
   * Return `undefined` if the value is valid, or a string describing the
   * validation error. The error string is associated with
   * {@link InvalidArgumentReason.CUSTOM_VALIDATION}.
   *
   * Example: ensure array values are unique:
   * ```typescript
   * validate: (value) => {
   *   const arr = value as string[];
   *   return new Set(arr).size !== arr.length
   *     ? "values must be unique"
   *     : undefined;
   * }
   * ```
   */
  readonly validate?: (
    value: ArgumentValueType | ArgumentValues | Array<ArgumentValues>,
  ) => string | undefined;
}
