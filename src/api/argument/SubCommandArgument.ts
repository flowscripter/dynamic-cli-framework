import type Argument from "./Argument.ts";

export const MAXIMUM_ARGUMENT_ARRAY_SIZE = 255;

/**
 * Interface to be implemented by all {@link SubCommand} arguments.
 */
export default interface SubCommandArgument extends Argument {
  /**
   * Name of the argument.
   *
   * Must consist of alphanumeric non-whitespace ASCII or `_` and `-` characters. Cannot start with `-`.
   */
  readonly name: string;

  /**
   * Optional description of the argument.
   */
  readonly description?: string;
}
