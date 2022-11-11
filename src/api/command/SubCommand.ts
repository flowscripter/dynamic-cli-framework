import Command from "./Command.ts";
import Option from "../argument/Option.ts";
import Positional from "../argument/Positional.ts";
import UsageExample from "./UsageExample.ts";
import ComplexOption from "../argument/ComplexOption.ts";

/**
 * Interface for a sub-command.
 */
export default interface SubCommand extends Command {
  /**
   * {@link Option} argument definitions for the sub-command.
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
}
