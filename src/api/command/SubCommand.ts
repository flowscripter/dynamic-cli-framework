import type Command from "./Command.ts";
import type Option from "../argument/Option.ts";
import type Positional from "../argument/Positional.ts";
import type UsageExample from "./UsageExample.ts";
import type ComplexOption from "../argument/ComplexOption.ts";
import type { ArgumentValues } from "../argument/ArgumentValueTypes.ts";
import type Context from "../Context.ts";

/**
 * Interface for a sub-command.
 */
export default interface SubCommand extends Command {
  /**
   * {@link Option} or {@link ComplexOption} argument definitions for the sub-command.
   */
  readonly options: ReadonlyArray<Option | ComplexOption>;

  /**
   * {@link Positional} argument definitions for the sub-command.
   */
  readonly positionals: ReadonlyArray<Positional>;

  /**
   * Optional grouping topic of the command to structuring of help output.
   */
  readonly helpTopic?: string;

  /**
   * Optional usage examples for the command to support help output.
   */
  readonly usageExamples?: ReadonlyArray<UsageExample>;

  /**
   * Execute the command.
   *
   * @param context the {@link Context} in which to execute the command.
   * @param argumentValues the argument values for the command. This may be empty if
   * the command's {@link Option} and {@link Positional} instances are all optional and no argument values were provided.
   */
  execute(context: Context, argumentValues: ArgumentValues): Promise<void>;
}
