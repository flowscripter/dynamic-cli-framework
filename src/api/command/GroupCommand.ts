import SubCommand from "./SubCommand.ts";
import Command from "./Command.ts";
import Context from "../Context.ts";

/**
 * Interface for a group command.
 */
export default interface GroupCommand extends Command {
  /**
   * Array of {@link SubCommand} instances for this group command. Must contain at least one sub-command.
   */
  readonly memberSubCommands: ReadonlyArray<SubCommand>;

  /**
   * Execute the command.
   *
   * @param context the {@link Context} in which to execute the command.
   */
  execute(context: Context): Promise<void>;
}
