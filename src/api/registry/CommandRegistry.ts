import GroupCommand from "../command/GroupCommand.ts";
import SubCommand from "../command/SubCommand.ts";
import GlobalCommand from "../command/GlobalCommand.ts";
import GlobalModifierCommand from "../command/GlobalModifierCommand.ts";

/**
 * Interface used by a {@link CLI} to register {@link Command} instances.
 */
export default interface CommandRegistry {
  /**
   * Get all registered {@link SubCommand} instances.
   */
  getSubCommands(): ReadonlyArray<SubCommand>;

  /**
   * Get all registered {@link GroupCommand} instances.
   */
  getGroupCommands(): ReadonlyArray<GroupCommand>;

  /**
   * Get all registered {@link GlobalCommand} instances.
   */
  getGlobalCommands(): ReadonlyArray<GlobalCommand>;

  /**
   * Get all registered {@link GlobalModifierCommand} instances.
   */
  getGlobalModifierCommands(): ReadonlyArray<GlobalModifierCommand>;

  /**
   * Get a registered {@link SubCommand} by name.
   */
  getSubCommandByName(name: string): SubCommand | undefined;

  /**
   * Get a registered {@link GroupCommand} by name.
   */
  getGroupCommandByName(name: string): GroupCommand | undefined;

  /**
   * Get a registered {@link GroupCommand} and member {@link SubCommand} by
   * combined name e.g. `<group-command-name>:<member-sub-command-name>`.
   */
  getGroupCommandAndMemberSubCommandByName(
    getGroupCommandAndMemberSubCommandByName: string,
  ): { groupCommand: GroupCommand; memberSubCommand: SubCommand } | undefined;

  /**
   * Get a registered {@link GlobalCommand} by name.
   */
  getGlobalCommandByName(name: string): GlobalCommand | undefined;

  /**
   * Get a registered {@link GlobalCommand} by short alias.
   */
  getGlobalCommandByShortAlias(shortAlias: string): GlobalCommand | undefined;

  /**
   * Get a registered {@link GlobalModifierCommand} by name.
   */
  getGlobalModifierCommandByName(
    name: string,
  ): GlobalModifierCommand | undefined;

  /**
   * Get a registered {@link GlobalModifierCommand} by short alias.
   */
  getGlobalModifierCommandByShortAlias(
    shortAlias: string,
  ): GlobalModifierCommand | undefined;
}
