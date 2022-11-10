import { assertEquals, describe, it } from "../../test_deps.ts";
import {
  GlobalCommand,
  GlobalModifierCommand,
  GroupCommand,
  SubCommand,
} from "../../../mod.ts";
import {
  isGlobalCommand,
  isGlobalModifierCommand,
  isGroupCommand,
  isNonModifierCommand,
  isSubCommand,
} from "../../../src/api/command/CommandTypeGuards.ts";

function getSubCommand(): SubCommand {
  return {
    name: "command",
    options: [],
    positionals: [],
    execute: async (): Promise<void> => {},
  };
}

function getGroupCommand(): GroupCommand {
  return {
    name: "command",
    memberSubCommands: [getSubCommand()],
    execute: async (): Promise<void> => {},
  };
}

function getGlobalCommand(): GlobalCommand {
  return {
    name: "command",
    execute: async (): Promise<void> => {},
  };
}

function getGlobalModifierCommand(): GlobalModifierCommand {
  return {
    name: "command",
    executePriority: 1,
    execute: async (): Promise<void> => {},
  };
}

describe("CommandTypeGuards", () => {
  it("isSubCommand works", () => {
    assertEquals(isSubCommand(getSubCommand()), true);
    assertEquals(isSubCommand(getGroupCommand()), false);
    assertEquals(isSubCommand(getGlobalCommand()), false);
    assertEquals(isSubCommand(getGlobalModifierCommand()), false);
  });

  it("isGroupCommand works", () => {
    assertEquals(isGroupCommand(getSubCommand()), false);
    assertEquals(isGroupCommand(getGroupCommand()), true);
    assertEquals(isGroupCommand(getGlobalCommand()), false);
    assertEquals(isGroupCommand(getGlobalModifierCommand()), false);
  });

  it("isGlobalCommand works", () => {
    assertEquals(isGlobalCommand(getSubCommand()), false);
    assertEquals(isGlobalCommand(getGroupCommand()), false);
    assertEquals(isGlobalCommand(getGlobalCommand()), true);
    assertEquals(isGlobalCommand(getGlobalModifierCommand()), false);
  });

  it("isGlobalModifierCommand works", () => {
    assertEquals(isGlobalModifierCommand(getSubCommand()), false);
    assertEquals(isGlobalModifierCommand(getGroupCommand()), false);
    assertEquals(isGlobalModifierCommand(getGlobalCommand()), false);
    assertEquals(isGlobalModifierCommand(getGlobalModifierCommand()), true);
  });

  it("isNonModifierCommand works", () => {
    assertEquals(isNonModifierCommand(getSubCommand()), true);
    assertEquals(isNonModifierCommand(getGroupCommand()), true);
    assertEquals(isNonModifierCommand(getGlobalCommand()), true);
    assertEquals(isNonModifierCommand(getGlobalModifierCommand()), false);
  });
});
