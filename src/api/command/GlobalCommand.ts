import Command from "./Command.ts";
import GlobalCommandArgument from "../argument/GlobalCommandArgument.ts";

/**
 * Interface for a global command.
 */
export default interface GlobalCommand extends Command {
  /**
   * Optional short alias for the global command.
   *
   * Must consist of a single alphanumeric non-whitespace ASCII character.
   */
  readonly shortAlias?: string;

  /**
   * Optional {@link GlobalCommandArgument} for the command.
   */
  readonly argument?: GlobalCommandArgument;
}
