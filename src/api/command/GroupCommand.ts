import SubCommand from "./SubCommand.ts";
import Command from "./Command.ts";

/**
 * Interface for a group command.
 */
export default interface GroupCommand extends Command {
  /**
   * Array of {@link SubCommand} instances for this group command. Must contain at least one sub-command.
   */
  readonly memberSubCommands: ReadonlyArray<SubCommand>;
}
