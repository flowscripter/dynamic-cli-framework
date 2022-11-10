import Context from "../runtime/Context.ts";
import { ArgumentValues } from "../argument/ArgumentValueTypes.ts";

/**
 * Common interface for all command types.
 */
export default interface Command {
  /**
   * Name of the command.
   *
   * Must consist of alphanumeric non-whitespace ASCII characters or `_` and `-` characters. Cannot start with `-`.
   */
  readonly name: string;

  /**
   * Optional description of the command.
   */
  readonly description?: string;

  /**
   * Execute the command.
   *
   * @param argumentValues the argument values for the command.
   * @param context the {@link Context} in which to execute the command.
   */
  execute(argumentValues: ArgumentValues, context: Context): Promise<void>;
}
