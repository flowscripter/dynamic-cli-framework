import type GlobalCommand from "./GlobalCommand.ts";

/**
 * Interface for a global modifier command.
 */
export default interface GlobalModifierCommand extends GlobalCommand {
  /**
   * Used to determine the order in which multiple global modifier command instances
   * parsed from the provided arguments will be executed. Higher values will execute before lower values.
   */
  readonly executePriority: number;
}
