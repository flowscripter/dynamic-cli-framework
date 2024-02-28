import Command from "./Command.ts";
import GlobalCommandArgument from "../argument/GlobalCommandArgument.ts";
import Context from "../Context.ts";
import { ArgumentSingleValueType } from "../argument/ArgumentValueTypes.ts";

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

  /**
   * Execute the command.
   *
   * @param context the {@link Context} in which to execute the command.
   * @param argumentValue optional argument value for the command. This will be populated unless
   * the command's {@link GlobalCommandArgument} is optional and the argument value was not provided.
   */
  execute(
    context: Context,
    argumentValue?: ArgumentSingleValueType,
  ): Promise<void>;
}
