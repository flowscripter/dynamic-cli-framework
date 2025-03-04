import type CommandRegistry from "./CommandRegistry.ts";
import type GlobalCommand from "../../api/command/GlobalCommand.ts";
import type GlobalModifierCommand from "../../api/command/GlobalModifierCommand.ts";
import type GroupCommand from "../../api/command/GroupCommand.ts";
import type SubCommand from "../../api/command/SubCommand.ts";
import type Command from "../../api/command/Command.ts";
import {
  isGlobalCommand,
  isGlobalModifierCommand,
  isGroupCommand,
  isSubCommand,
} from "../command/CommandTypeGuards.ts";
import getLogger from "../../util/logger.ts";
import type CommandValidator from "../command/CommandValidator.ts";

const logger = getLogger("DefaultCommandRegistry");

/**
 * Default implementation of a {@link CommandRegistry}.
 */
export default class DefaultCommandRegistry implements CommandRegistry {
  readonly #commandValidator: CommandValidator | undefined;
  readonly #subCommandsByName: Map<string, SubCommand> = new Map();
  readonly #groupCommandsByName: Map<string, GroupCommand> = new Map();
  readonly #groupCommandsAndMemberSubCommandsByName: Map<
    string,
    { groupCommand: GroupCommand; command: SubCommand }
  > = new Map();
  readonly #globalCommandsByName: Map<string, GlobalCommand> = new Map();
  readonly #globalCommandsByShortAlias: Map<string, GlobalCommand> = new Map();
  readonly #globalModifierCommandsByName: Map<
    string,
    GlobalModifierCommand
  > = new Map();
  readonly #globalModifierCommandsByShortAlias: Map<
    string,
    GlobalModifierCommand
  > = new Map();
  readonly #globalModifierCommandsByNameByServiceId: Map<
    string,
    Map<string, GlobalModifierCommand>
  > = new Map();
  readonly #globalModifierCommandsByShortAliasByServiceId: Map<
    string,
    Map<string, GlobalModifierCommand>
  > = new Map();
  readonly #globalModifierCommandsByNameWithoutServiceId: Map<
    string,
    GlobalModifierCommand
  > = new Map();
  readonly #globalModifierCommandsByShortAliasWithoutServiceId: Map<
    string,
    GlobalModifierCommand
  > = new Map();
  readonly #nonModifierCommandsByName: Map<string, Command> = new Map();

  /**
   * Constructor taking an optional initial list of {@link Command} instances to register.
   *
   * @param commands optional list of {@link Command} instances.
   * @param commandValidator optional {@link CommandValidator} to use for all registered {@link Command} instances.
   */
  public constructor(
    commands?: ReadonlyArray<Command>,
    commandValidator?: CommandValidator,
  ) {
    this.#commandValidator = commandValidator;
    commands?.forEach((command) => this.addCommand(command));
  }

  /**
   * Validate a {@link GlobalCommand} or by extension a {@link GlobalModifierCommand} against those registered so far.
   *
   * @throws {Error} if the name of the provided {@link GlobalCommand} is already registered.
   */
  #validateGlobalCommandWithOtherGlobalCommands(
    globalCommand: GlobalCommand,
  ): void {
    if (this.#globalCommandsByName.has(globalCommand.name)) {
      throw new Error(
        `Command name: ${globalCommand.name} duplicates the name of an existing command`,
      );
    }
    if (this.#globalModifierCommandsByName.has(globalCommand.name)) {
      throw new Error(
        `Command name: ${globalCommand.name} duplicates the name of an existing command`,
      );
    }
    if (globalCommand.shortAlias !== undefined) {
      if (this.#globalCommandsByShortAlias.has(globalCommand.shortAlias)) {
        throw new Error(
          `Command name: ${globalCommand.shortAlias} duplicates the short alias of an existing command`,
        );
      }
      if (
        this.#globalModifierCommandsByShortAlias.has(globalCommand.shortAlias)
      ) {
        throw new Error(
          `Command name: ${globalCommand.shortAlias} duplicates the short alias of an existing command`,
        );
      }
    }
  }

  /**
   * Validate a non-global {@link Command} against those registered so far.
   *
   * @throws {Error} if the name of the provided {@link Command} is already registered.
   */
  #validateNonGlobalCommandWithOtherNonGlobalCommands(
    command: Command,
  ): void {
    if (this.#subCommandsByName.has(command.name)) {
      throw new Error(
        `Command name: ${command.name} duplicates the name of an existing command`,
      );
    }
    if (this.#groupCommandsByName.has(command.name)) {
      throw new Error(
        `Command name: ${command.name} duplicates the name of an existing command`,
      );
    }
  }

  public getSubCommands(): ReadonlyArray<SubCommand> {
    return Array.from(this.#subCommandsByName.values());
  }

  public getGroupCommands(): ReadonlyArray<GroupCommand> {
    return Array.from(this.#groupCommandsByName.values());
  }

  public getGlobalCommands(): ReadonlyArray<GlobalCommand> {
    return Array.from(this.#globalCommandsByName.values());
  }

  public getGlobalModifierCommands(): ReadonlyArray<GlobalModifierCommand> {
    return Array.from(this.#globalModifierCommandsByName.values());
  }

  /**
   * Add a {@link Command} to the registry optionally specifying a service ID if the command
   * was provided by a {@link ServiceProvider}.
   *
   * @param command the {@link Command} to register.
   * @param serviceId the service ID if the command was provided by a {@link ServiceProvider}.
   */
  public addCommand(command: Command, serviceId?: string): void {
    logger.debug("Adding command: %s", command.name);

    if (this.#commandValidator !== undefined) {
      this.#commandValidator.validate(command);
    }

    if (isSubCommand(command)) {
      this.#validateNonGlobalCommandWithOtherNonGlobalCommands(command);
      this.#subCommandsByName.set(command.name, command);
      this.#nonModifierCommandsByName.set(command.name, command);
      return;
    }

    if (isGroupCommand(command)) {
      this.#validateNonGlobalCommandWithOtherNonGlobalCommands(command);
      this.#groupCommandsByName.set(command.name, command);
      this.#nonModifierCommandsByName.set(command.name, command);
      const groupCommand = command as GroupCommand;
      groupCommand.memberSubCommands.forEach((command) => {
        this.#groupCommandsAndMemberSubCommandsByName.set(
          `${groupCommand.name}:${command.name}`,
          {
            groupCommand,
            command,
          },
        );
      });
      return;
    }

    if (isGlobalCommand(command)) {
      this.#validateGlobalCommandWithOtherGlobalCommands(command);
      this.#globalCommandsByName.set(command.name, command);
      if (command.shortAlias !== undefined) {
        this.#globalCommandsByShortAlias.set(command.shortAlias, command);
      }
      this.#nonModifierCommandsByName.set(command.name, command);
      return;
    }

    if (isGlobalModifierCommand(command)) {
      this.#validateGlobalCommandWithOtherGlobalCommands(command);
      this.#globalModifierCommandsByName.set(command.name, command);
      if (command.shortAlias !== undefined) {
        this.#globalModifierCommandsByShortAlias.set(
          command.shortAlias,
          command,
        );
      }
      if (serviceId === undefined) {
        this.#globalModifierCommandsByNameWithoutServiceId.set(
          command.name,
          command,
        );
        if (command.shortAlias !== undefined) {
          this.#globalModifierCommandsByShortAliasWithoutServiceId.set(
            command.shortAlias,
            command,
          );
        }
      } else {
        if (!this.#globalModifierCommandsByNameByServiceId.has(serviceId)) {
          this.#globalModifierCommandsByNameByServiceId.set(
            serviceId,
            new Map(),
          );
        }
        this.#globalModifierCommandsByNameByServiceId.get(serviceId)!.set(
          command.name,
          command,
        );
        if (command.shortAlias !== undefined) {
          if (
            !this.#globalModifierCommandsByShortAliasByServiceId.has(serviceId)
          ) {
            this.#globalModifierCommandsByShortAliasByServiceId.set(
              serviceId,
              new Map(),
            );
          }
          this.#globalModifierCommandsByShortAliasByServiceId.get(serviceId)!
            .set(command.shortAlias, command);
        }
      }
      return;
    }
  }

  public getSubCommandByName(name: string): SubCommand | undefined {
    return this.#subCommandsByName.get(name);
  }

  public getGroupCommandByName(name: string): GroupCommand | undefined {
    return this.#groupCommandsByName.get(name);
  }

  public getGroupCommandAndMemberSubCommandByJoinedName(
    groupAndMemberSubCommandName: string,
  ): { groupCommand: GroupCommand; command: SubCommand } | undefined {
    return this.#groupCommandsAndMemberSubCommandsByName.get(
      groupAndMemberSubCommandName,
    );
  }

  public getGlobalCommandByName(name: string): GlobalCommand | undefined {
    return this.#globalCommandsByName.get(name);
  }

  public getGlobalModifierCommandByName(
    name: string,
  ): GlobalModifierCommand | undefined {
    return this.#globalModifierCommandsByName.get(name);
  }

  public getGroupAndMemberCommandsByJoinedName(): ReadonlyMap<
    string,
    { groupCommand: GroupCommand; command: SubCommand }
  > {
    return this.#groupCommandsAndMemberSubCommandsByName;
  }

  public getGlobalModifierCommandsByNameProvidedByService(
    serviceId: string,
  ): ReadonlyMap<string, GlobalModifierCommand> {
    const getGlobalModifierCommandByName = this
      .#globalModifierCommandsByNameByServiceId.get(serviceId);

    if (getGlobalModifierCommandByName !== undefined) {
      return getGlobalModifierCommandByName;
    }
    return new Map();
  }

  public getGlobalModifierCommandsByShortAliasProvidedByService(
    serviceId: string,
  ): ReadonlyMap<string, GlobalModifierCommand> {
    const getGlobalModifierCommandByShortAlias = this
      .#globalModifierCommandsByShortAliasByServiceId.get(serviceId);

    if (getGlobalModifierCommandByShortAlias !== undefined) {
      return getGlobalModifierCommandByShortAlias;
    }
    return new Map();
  }

  public getGlobalModifierCommandsByNameNotProvidedByService(): ReadonlyMap<
    string,
    GlobalModifierCommand
  > {
    return this.#globalModifierCommandsByNameWithoutServiceId;
  }

  public getGlobalModifierCommandsByShortAliasNotProvidedByService(): ReadonlyMap<
    string,
    GlobalModifierCommand
  > {
    return this.#globalModifierCommandsByShortAliasWithoutServiceId;
  }

  public getNonModifierCommandsByName(): ReadonlyMap<
    string,
    Command
  > {
    return this.#nonModifierCommandsByName;
  }

  public getGlobalCommandsByShortAlias(): ReadonlyMap<string, GlobalCommand> {
    return this.#globalCommandsByShortAlias;
  }
}
