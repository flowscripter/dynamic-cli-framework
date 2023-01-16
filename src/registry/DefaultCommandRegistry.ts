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
import getLogger from "../util/logger.ts";
import CommandValidator from "../runtime/command/CommandValidator.ts";

const logger = getLogger("DefaultCommandRegistry");

/**
 * Default implementation of a {@link CommandRegistry}.
 */
export default class DefaultCommandRegistry implements CommandRegistry {
  private readonly commandValidator: CommandValidator | undefined;
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

  /**
   * Constructor taking an optional initial list of {@link Command} instances to register.
   *
   * @param commands optional list of {@link Command} instances.
   * @param commandValidator optional {@link CommandValidator} to use for all registered {@link Command} instances.
   */
  public constructor(commands?: ReadonlyArray<Command>, commandValidator?: CommandValidator) {
    this.commandValidator = commandValidator;
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

  public getSubCommands(): ReadonlyArray<SubCommand> {
    return Array.from(this.subCommandsByName.values());
  }

  public getGroupCommands(): ReadonlyArray<GroupCommand> {
    return Array.from(this.groupCommandsByName.values());
  }

  public getGlobalCommands(): ReadonlyArray<GlobalCommand> {
    return Array.from(this.globalCommandsByName.values());
  }

  public getGlobalModifierCommands(): ReadonlyArray<GlobalModifierCommand> {
    return Array.from(this.globalModifierCommandsByName.values());
  }

  public addCommand(command: Command): void {
    logger.debug(() => `Adding command: ${command.name}`);

    if (this.commandValidator !== undefined) {
      this.commandValidator.validate(command);
    }

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
          `${groupCommand.name}:${memberSubCommand.name}`,
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

  public getGroupCommandAndMemberSubCommandByName(
    groupAndMemberSubCommandName: string,
  ): { groupCommand: GroupCommand; memberSubCommand: SubCommand } | undefined {
    return this.groupCommandsAndMemberSubCommandsByName.get(
      groupAndMemberSubCommandName,
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
