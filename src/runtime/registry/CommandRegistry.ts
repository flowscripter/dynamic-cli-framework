import type GroupCommand from "../../api/command/GroupCommand.ts";
import type SubCommand from "../../api/command/SubCommand.ts";
import type GlobalCommand from "../../api/command/GlobalCommand.ts";
import type GlobalModifierCommand from "../../api/command/GlobalModifierCommand.ts";
import type Command from "../../api/command/Command.ts";

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
  getGroupCommandAndMemberSubCommandByJoinedName(
    getGroupCommandAndMemberSubCommandByName: string,
  ): { groupCommand: GroupCommand; command: SubCommand } | undefined;

  /**
   * Get a registered {@link GlobalCommand} by name.
   */
  getGlobalCommandByName(name: string): GlobalCommand | undefined;

  /**
   * Get a registered {@link GlobalCommand} by short alias.
   */
  // getGlobalCommandByShortAlias(shortAlias: string): GlobalCommand | undefined;

  /**
   * Get a registered {@link GlobalModifierCommand} by name.
   */
  getGlobalModifierCommandByName(
    name: string,
  ): GlobalModifierCommand | undefined;

  /**
   * Get a registered {@link GlobalModifierCommand} by short alias.
   */
  // getGlobalModifierCommandByShortAlias(
  //   shortAlias: string,
  // ): GlobalModifierCommand | undefined;

  /**
   * Get a map of all registered {@link GroupCommand} and member {@link SubCommand} instance combinations by
   * combined name e.g. `<group-command-name>:<member-sub-command-name>`.
   */
  getGroupAndMemberCommandsByJoinedName(): ReadonlyMap<
    string,
    { groupCommand: GroupCommand; command: SubCommand }
  >;

  /**
   * Get a map of all registered {@link GlobalModifierCommand} instances by name provided by the specified service.
   */
  getGlobalModifierCommandsByNameProvidedByService(
    serviceId: string,
  ): ReadonlyMap<string, GlobalModifierCommand>;

  /**
   * Get a map of all registered {@link GlobalModifierCommand} instances by short alias provided by the specified service.
   */
  getGlobalModifierCommandsByShortAliasProvidedByService(
    serviceId: string,
  ): ReadonlyMap<string, GlobalModifierCommand>;

  /**
   * Get a map of all registered {@link GlobalModifierCommand} instances by name not provided by a service.
   */
  getGlobalModifierCommandsByNameNotProvidedByService(): ReadonlyMap<
    string,
    GlobalModifierCommand
  >;

  /**
   * Get a map of all registered {@link GlobalModifierCommand} instances by short alias not provided by a service.
   */
  getGlobalModifierCommandsByShortAliasNotProvidedByService(): ReadonlyMap<
    string,
    GlobalModifierCommand
  >;

  /**
   * Get a map of all registered non-modifier {@link Command} instances by name.
   */
  getNonModifierCommandsByName(): ReadonlyMap<string, Command>;

  /**
   * Get a map of all registered {@link GlobalCommand} instances by short alias.
   */
  getGlobalCommandsByShortAlias(): ReadonlyMap<string, GlobalCommand>;
}
