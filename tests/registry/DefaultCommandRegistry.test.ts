import {
  ArgumentValueTypeName,
  GlobalCommand,
  GroupCommand,
  Option,
  Positional,
  SubCommand,
} from "../../mod.ts";
import DefaultCommandRegistry from "../../src/runtime/registry/DefaultCommandRegistry.ts";
import { assertThrows, describe, it } from "../test_deps.ts";

function getSubCommand(
  name: string,
  options: Option[],
  positionals: Positional[],
): SubCommand {
  return {
    name,
    options,
    positionals,
    execute: async (): Promise<void> => {},
  };
}

function getGlobalCommand(name: string): GlobalCommand {
  return {
    name,
    argument: {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    },
    execute: async (): Promise<void> => {},
  };
}

function getGroupCommand(name: string): GroupCommand {
  return {
    name,
    memberSubCommands: [getSubCommand("foo", [], [])],
    execute: async (): Promise<void> => {},
  };
}
describe("DefaultCommandRegistry", () => {
  it("Check for duplicate non-global command name", () => {
    const command1 = getSubCommand("c1", [], []);
    const command2 = getSubCommand("c1", [], []);
    const commandRegistry = new DefaultCommandRegistry();

    commandRegistry.addCommand(command1);
    assertThrows(() => commandRegistry.addCommand(command2));
  });

  it("Check for duplicate sub-command and group command name", () => {
    const command1 = getGroupCommand("c1");
    const command2 = getSubCommand("c1", [], []);
    const commandRegistry = new DefaultCommandRegistry();

    commandRegistry.addCommand(command1);
    assertThrows(() => commandRegistry.addCommand(command2));
  });

  it("Check for duplicate global command name", () => {
    const command1 = getGlobalCommand("c1");
    const command2 = getGlobalCommand("c1");
    const commandRegistry = new DefaultCommandRegistry();

    commandRegistry.addCommand(command1);
    assertThrows(() => commandRegistry.addCommand(command2));
  });

  it("Allow duplicate command name between sub-command and global command", () => {
    const subCommand = getSubCommand("c1", [], []);
    const globalCommand = getGlobalCommand("c1");
    const commandRegistry = new DefaultCommandRegistry();

    commandRegistry.addCommand(subCommand);
    commandRegistry.addCommand(globalCommand);
  });
});
