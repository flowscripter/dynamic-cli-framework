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
   * Must consist of alphanumeric non-whitespace ASCII or `_` and `-` characters. Cannot start with `-`.
   */
  readonly name: string;

  /**
   * Type of the argument value.
   */
  readonly type: ArgumentValueTypeName;

  /**
   * Optional list of values that the value must match.
   */
  readonly allowableValues?: ReadonlyArray<ArgumentSingleValueType>;

  /**
   * Optional configuration key to use for the argument.
   *
   * Must consist of alphanumeric non-whitespace uppercase ASCII or `_` characters. Cannot start with a digit or `_`.
   *
   * If not specified the configuration key is determined as follows:
   *
   * A prefix of the {@link CLIConfig.name} and the {@link Command.name} followed by the path to the value, with all characters
   * capitalised and spaces, array braces and `.` path separators replaced by `_`. Some examples:
   *
   * ```
   * MYCLI_COMMAND1_ARG1
   * MYCLI_COMMAND1_ARG2_0_ARG3
   * MYCLI_COMMAND1_ARG2_1_ARG3
   * MYCLI_COMMAND2_FOO_0
   * MYCLI_COMMAND2_FOO_1
   * ```
   *
   * NOTE: Regardless of whether a {@link configurationKey} is specified, or the default is relied upon,
   * it will only be used if the parent {@link Command} has specified {@link Command.enableConfiguration} as `true`.
   */
  readonly configurationKey?: string;
}
