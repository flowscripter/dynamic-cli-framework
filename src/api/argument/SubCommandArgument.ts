import Argument from "./Argument.ts";

/**
 * Interface to be implemented by all {@link SubCommand} arguments.
 */
export default interface SubCommandArgument extends Argument {
  /**
   * Optional description of the argument.
   */
  readonly description?: string;
}
