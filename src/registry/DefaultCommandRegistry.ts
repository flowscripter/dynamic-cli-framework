import CommandRegistry from "../api/registry/CommandRegistry.ts";
import GlobalCommand from "../api/command/GlobalCommand.ts";
import GlobalModifierCommand from "../api/command/GlobalModifierCommand.ts";
import GroupCommand from "../api/command/GroupCommand.ts";
import SubCommand from "../api/command/SubCommand.ts";
import Command from "../api/command/Command.ts";
import {
  isGlobalCommand,
  isGlobalModifierCommand,
  isGroupCommand,
  isSubCommand,
} from "../api/command/CommandTypeGuards.ts";

/**
 * Default implementation of a {@link CommandRegistry}.
 */
export default class DefaultCommandRegistry implements CommandRegistry {
  private readonly subCommandsByName: Map<string, SubCommand> = new Map();
  private readonly groupCommandsByName: Map<string, GroupCommand> = new Map();
  private readonly groupCommandsAndMemberSubCommandsByName: Map<
    string,
    { groupCommand: GroupCommand; memberSubCommand: SubCommand }
  > = new Map();
  private readonly globalCommandsByName: Map<string, GlobalCommand> = new Map();
  private readonly globalCommandsByShortAlias: Map<string, GlobalCommand> =
    new Map();
  private readonly globalModifierCommandsByName: Map<
    string,
    GlobalModifierCommand
  > = new Map();
  private readonly globalModifierCommandsByShortAlias: Map<
    string,
    GlobalModifierCommand
  > = new Map();

  public constructor(commands?: ReadonlyArray<Command>) {
    commands?.forEach((command) => this.addCommand(command));
  }

  /**
   * Validate a {@link GlobalCommand} or by extension a {@link GlobalModifierCommand} against those registered so far.
   *
   * @throws {Error} if the name of the provided {@link GlobalCommand} is already registered.
   */
  private validateGlobalCommandWithOtherGlobalCommands(
    globalCommand: GlobalCommand,
  ): void {
    if (this.globalCommandsByName.has(globalCommand.name)) {
      throw new Error(
        `Command name: ${globalCommand.name} duplicates the name of an existing command`,
      );
    }
    if (this.globalModifierCommandsByName.has(globalCommand.name)) {
      throw new Error(
        `Command name: ${globalCommand.name} duplicates the name of an existing command`,
      );
    }
  }

  /**
   * Validate a non-global {@link Command} against those registered so far.
   *
   * @throws {Error} if the name of the provided {@link Command} is already registered.
   */
  private validateNonGlobalCommandWithOtherNonGlobalCommands(
    command: Command,
  ): void {
    if (this.subCommandsByName.has(command.name)) {
      throw new Error(
        `Command name: ${command.name} duplicates the name of an existing command`,
      );
    }
    if (this.groupCommandsByName.has(command.name)) {
      throw new Error(
        `Command name: ${command.name} duplicates the name of an existing command`,
      );
    }
  }

  public addCommand(command: Command): void {
    if (isSubCommand(command)) {
      this.validateNonGlobalCommandWithOtherNonGlobalCommands(command);
      this.subCommandsByName.set(command.name, command);
      return;
    }

    if (isGroupCommand(command)) {
      this.validateNonGlobalCommandWithOtherNonGlobalCommands(command);
      this.groupCommandsByName.set(command.name, command);
      const groupCommand = command as GroupCommand;
      groupCommand.memberSubCommands.forEach((memberSubCommand) => {
        this.groupCommandsAndMemberSubCommandsByName.set(
          `${groupCommand.name}-${memberSubCommand.name}`,
          {
            groupCommand,
            memberSubCommand,
          },
        );
      });
      return;
    }

    if (isGlobalCommand(command)) {
      this.validateGlobalCommandWithOtherGlobalCommands(command);
      this.globalCommandsByName.set(command.name, command);
      if (command.shortAlias !== undefined) {
        this.globalCommandsByShortAlias.set(command.shortAlias, command);
      }
      return;
    }

    if (isGlobalModifierCommand(command)) {
      this.validateGlobalCommandWithOtherGlobalCommands(command);
      this.globalModifierCommandsByName.set(command.name, command);
      if (command.shortAlias !== undefined) {
        this.globalModifierCommandsByShortAlias.set(
          command.shortAlias,
          command,
        );
      }
      return;
    }
  }

  public getSubCommandByName(name: string): SubCommand | undefined {
    return this.subCommandsByName.get(name);
  }

  public getGroupCommandByName(name: string): GroupCommand | undefined {
    return this.groupCommandsByName.get(name);
  }

  public getGroupCommandAndMemberSubCommandByNames(
    groupCommandName: string,
    memberSubCommandName: string,
  ): { groupCommand: GroupCommand; memberSubCommand: SubCommand } | undefined {
    return this.groupCommandsAndMemberSubCommandsByName.get(
      `${groupCommandName}-${memberSubCommandName}`,
    );
  }

  public getGlobalCommandByName(name: string): GlobalCommand | undefined {
    return this.globalCommandsByName.get(name);
  }

  public getGlobalCommandByShortAlias(
    shortAlias: string,
  ): GlobalCommand | undefined {
    return this.globalCommandsByShortAlias.get(shortAlias);
  }

  public getGlobalModifierCommandByName(
    name: string,
  ): GlobalModifierCommand | undefined {
    return this.globalModifierCommandsByName.get(name);
  }

  public getGlobalModifierCommandByShortAlias(
    shortAlias: string,
  ): GlobalModifierCommand | undefined {
    return this.globalModifierCommandsByShortAlias.get(shortAlias);
  }
}
