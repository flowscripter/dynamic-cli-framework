import { assertEquals } from "@std/assert";
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

Deno.test("isSubCommand works", () => {
  assertEquals(isSubCommand(getSubCommandWithOption()), true);
  assertEquals(isSubCommand(getGroupCommand()), false);
  assertEquals(isSubCommand(getGlobalCommand()), false);
  assertEquals(isSubCommand(getGlobalModifierCommand()), false);
});

Deno.test("isGroupCommand works", () => {
  assertEquals(isGroupCommand(getSubCommandWithOption()), false);
  assertEquals(isGroupCommand(getGroupCommand()), true);
  assertEquals(isGroupCommand(getGlobalCommand()), false);
  assertEquals(isGroupCommand(getGlobalModifierCommand()), false);
});

Deno.test("isGlobalCommand works", () => {
  assertEquals(isGlobalCommand(getSubCommandWithOption()), false);
  assertEquals(isGlobalCommand(getGroupCommand()), false);
  assertEquals(isGlobalCommand(getGlobalCommand()), true);
  assertEquals(isGlobalCommand(getGlobalModifierCommand()), false);
});

Deno.test("isGlobalModifierCommand works", () => {
  assertEquals(isGlobalModifierCommand(getSubCommandWithOption()), false);
  assertEquals(isGlobalModifierCommand(getGroupCommand()), false);
  assertEquals(isGlobalModifierCommand(getGlobalCommand()), false);
  assertEquals(isGlobalModifierCommand(getGlobalModifierCommand()), true);
});
