import DefaultCommandRegistry from "../../../src/runtime/registry/DefaultCommandRegistry.ts";
import { assertEquals, assertThrows } from "@std/assert";
import {
  getGlobalCommand,
  getGlobalCommandWithShortAlias,
  getGlobalModifierCommand,
  getGroupCommand,
} from "../../fixtures/Command.ts";
import type SubCommand from "../../../src/api/command/SubCommand.ts";
import type Positional from "../../../src/api/argument/Positional.ts";
import type Option from "../../../src/api/argument/Option.ts";

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

Deno.test("Check for duplicate non-global command name", () => {
  const command1 = getSubCommand("c1", [], []);
  const command2 = getSubCommand("c1", [], []);
  const commandRegistry = new DefaultCommandRegistry();

  commandRegistry.addCommand(command1);
  assertThrows(() => commandRegistry.addCommand(command2));
});

Deno.test("Check for duplicate sub-command and group command name", () => {
  const command1 = getGroupCommand("c1");
  const command2 = getSubCommand("c1", [], []);
  const commandRegistry = new DefaultCommandRegistry();

  commandRegistry.addCommand(command1);
  assertThrows(() => commandRegistry.addCommand(command2));
});

Deno.test("Check for duplicate global command name", () => {
  const command1 = getGlobalCommand("c1");
  const command2 = getGlobalCommand("c1");
  const commandRegistry = new DefaultCommandRegistry();

  commandRegistry.addCommand(command1);
  assertThrows(() => commandRegistry.addCommand(command2));
});

Deno.test("Allow duplicate command name between sub-command and global command", () => {
  const subCommand = getSubCommand("c1", [], []);
  const globalCommand = getGlobalCommand("c1");
  const commandRegistry = new DefaultCommandRegistry();

  commandRegistry.addCommand(subCommand);
  commandRegistry.addCommand(globalCommand);
});

Deno.test("Getters work as expected", () => {
  const service1Id = "service1";
  const service2Id = "service2";
  const subCommand1 = getSubCommand("sc1", [], []);
  const subCommand2 = getSubCommand("sc2", [], []);
  const memberSubCommand1 = getSubCommand("msc1", [], []);
  const memberSubCommand2 = getSubCommand("msc2", [], []);
  const groupCommand1 = getGroupCommand("gc1", [memberSubCommand1]);
  const groupCommand2 = getGroupCommand("gc2", [memberSubCommand2]);
  const globalCommand1 = getGlobalCommandWithShortAlias("gc1", "1");
  const globalCommand2 = getGlobalCommandWithShortAlias("gc2", "2");
  const globalModifierCommand1 = getGlobalModifierCommand("gmc1", "3");
  const globalModifierCommand2 = getGlobalModifierCommand("gmc2", "4");
  const globalModifierCommand3 = getGlobalModifierCommand("gmc3", "5");
  const globalModifierCommand4 = getGlobalModifierCommand("gmc4", "6");

  const commandRegistry = new DefaultCommandRegistry();

  commandRegistry.addCommand(subCommand1);
  commandRegistry.addCommand(subCommand2);
  commandRegistry.addCommand(groupCommand1);
  commandRegistry.addCommand(groupCommand2);
  commandRegistry.addCommand(globalCommand1);
  commandRegistry.addCommand(globalCommand2);
  commandRegistry.addCommand(globalModifierCommand1);
  commandRegistry.addCommand(globalModifierCommand2);
  commandRegistry.addCommand(globalModifierCommand3, service1Id);
  commandRegistry.addCommand(globalModifierCommand4, service2Id);

  assertEquals(
    commandRegistry.getSubCommandByName(subCommand2.name)!.name,
    subCommand2.name,
  );
  assertEquals(
    commandRegistry.getGroupCommandByName(groupCommand2.name)!.name,
    groupCommand2.name,
  );
  assertEquals(
    commandRegistry.getGlobalCommandByName(globalCommand2.name)!.name,
    globalCommand2.name,
  );
  assertEquals(
    commandRegistry.getGlobalModifierCommandByName(
      globalModifierCommand2.name,
    )!.name,
    globalModifierCommand2.name,
  );

  const result1 = commandRegistry
    .getGroupCommandAndMemberSubCommandByJoinedName(
      `${groupCommand2.name}:${memberSubCommand2.name}`,
    );

  assertEquals(result1!.groupCommand.name, groupCommand2.name);
  assertEquals(result1!.command.name, memberSubCommand2.name);

  const result2 = commandRegistry.getGroupAndMemberCommandsByJoinedName();
  const result3 = result2!.get(
    `${groupCommand2.name}:${memberSubCommand2.name}`,
  );

  assertEquals(result3!.groupCommand.name, groupCommand2.name);
  assertEquals(result3!.command.name, memberSubCommand2.name);

  const result4 = commandRegistry
    .getGlobalModifierCommandsByNameNotProvidedByService();
  const result5 = result4!.get(globalModifierCommand2.name);

  assertEquals(result5!.name, globalModifierCommand2.name);

  const result6 = commandRegistry
    .getGlobalModifierCommandsByShortAliasNotProvidedByService();
  const result7 = result6!.get(globalModifierCommand2.shortAlias!);

  assertEquals(result7!.name, globalModifierCommand2.name);

  const result8 = commandRegistry.getGlobalCommandsByShortAlias();
  const result9 = result8!.get(globalCommand2.shortAlias!);

  assertEquals(result9!.name, globalCommand2.name);

  const result10 = commandRegistry.getNonModifierCommandsByName();
  const result11 = result10!.get(subCommand2.name);
  const result12 = result10!.get(globalCommand2.name);

  assertEquals(result11!.name, subCommand2.name);
  assertEquals(result12!.name, globalCommand2.name);

  const result13 = commandRegistry
    .getGlobalModifierCommandsByNameProvidedByService(service1Id);
  const result14 = result13!.get(globalModifierCommand3.name);

  assertEquals(result14!.name, globalModifierCommand3.name);

  const result15 = commandRegistry
    .getGlobalModifierCommandsByShortAliasProvidedByService(service2Id);
  const result16 = result15!.get(globalModifierCommand4.shortAlias!);

  assertEquals(result16!.name, globalModifierCommand4.name);
});
