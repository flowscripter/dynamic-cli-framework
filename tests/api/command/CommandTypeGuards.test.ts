import { assertEquals, describe, it } from "../../test_deps.ts";
import {
  getGlobalCommand,
  getGlobalModifierCommand,
  getGroupCommand,
  getSubCommandWithOption,
} from "../../fixtures/Command.ts";
import {
  isGlobalCommand,
  isGlobalModifierCommand,
  isGroupCommand,
  isSubCommand,
} from "../../../src/api/command/CommandTypeGuards.ts";

describe("CommandTypeGuards", () => {
  it("isSubCommand works", () => {
    assertEquals(isSubCommand(getSubCommandWithOption()), true);
    assertEquals(isSubCommand(getGroupCommand()), false);
    assertEquals(isSubCommand(getGlobalCommand()), false);
    assertEquals(isSubCommand(getGlobalModifierCommand()), false);
  });

  it("isGroupCommand works", () => {
    assertEquals(isGroupCommand(getSubCommandWithOption()), false);
    assertEquals(isGroupCommand(getGroupCommand()), true);
    assertEquals(isGroupCommand(getGlobalCommand()), false);
    assertEquals(isGroupCommand(getGlobalModifierCommand()), false);
  });

  it("isGlobalCommand works", () => {
    assertEquals(isGlobalCommand(getSubCommandWithOption()), false);
    assertEquals(isGlobalCommand(getGroupCommand()), false);
    assertEquals(isGlobalCommand(getGlobalCommand()), true);
    assertEquals(isGlobalCommand(getGlobalModifierCommand()), false);
  });

  it("isGlobalModifierCommand works", () => {
    assertEquals(isGlobalModifierCommand(getSubCommandWithOption()), false);
    assertEquals(isGlobalModifierCommand(getGroupCommand()), false);
    assertEquals(isGlobalModifierCommand(getGlobalCommand()), false);
    assertEquals(isGlobalModifierCommand(getGlobalModifierCommand()), true);
  });
});
