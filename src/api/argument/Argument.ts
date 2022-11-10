import {
  ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "./ArgumentValueTypes.ts";

/**
 * Interface to be implemented by all {@link Command} arguments.
 */
export default interface Argument {
  /**
   * Name of the argument.
   *
   * Must consist of alphanumeric non-whitespace ASCII characters or `_` and `-` characters. Cannot start with `-`.
   */
  readonly name: string;

  /**
   * Type of the argument value.
   */
  readonly type: ArgumentValueTypeName;

  /**
   * Optional list of values that the value must match.
   */
  readonly validValues?: ReadonlyArray<ArgumentSingleValueType>;
}
