import Argument from "./Argument.ts";

export const MAXIMUM_ARGUMENT_ARRAY_SIZE = 255;

/**
 * Interface to be implemented by all {@link SubCommand} arguments.
 */
export default interface SubCommandArgument extends Argument {
  /**
   * Optional description of the argument.
   */
  readonly description?: string;
}
