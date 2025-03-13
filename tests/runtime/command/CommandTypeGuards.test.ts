import { describe, expect, test } from "bun:test";
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
} from "../../../src/runtime/command/CommandTypeGuards.ts";

describe("CommandTypeGuards tests", () => {
  test("isSubCommand works", () => {
    expect(isSubCommand(getSubCommandWithOption())).toBeTrue();
    expect(isSubCommand(getGroupCommand())).toBeFalse();
    expect(isSubCommand(getGlobalCommand())).toBeFalse();
    expect(isSubCommand(getGlobalModifierCommand())).toBeFalse();
  });

  test("isGroupCommand works", () => {
    expect(isGroupCommand(getSubCommandWithOption())).toBeFalse();
    expect(isGroupCommand(getGroupCommand())).toBeTrue();
    expect(isGroupCommand(getGlobalCommand())).toBeFalse();
    expect(isGroupCommand(getGlobalModifierCommand())).toBeFalse();
  });

  test("isGlobalCommand works", () => {
    expect(isGlobalCommand(getSubCommandWithOption())).toBeFalse();
    expect(isGlobalCommand(getGroupCommand())).toBeFalse();
    expect(isGlobalCommand(getGlobalCommand())).toBeTrue();
    expect(isGlobalCommand(getGlobalModifierCommand())).toBeFalse();
  });

  test("isGlobalModifierCommand works", () => {
    expect(isGlobalModifierCommand(getSubCommandWithOption())).toBeFalse();
    expect(isGlobalModifierCommand(getGroupCommand())).toBeFalse();
    expect(isGlobalModifierCommand(getGlobalCommand())).toBeFalse();
    expect(isGlobalModifierCommand(getGlobalModifierCommand())).toBeTrue();
  });
});
