import { describe, expect, test } from "bun:test";
import DefaultCommandRegistry from "../../../src/runtime/registry/DefaultCommandRegistry.ts";
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
describe("DefaultCommandRegistry tests", () => {
  test("Check for duplicate non-global command name", () => {
    const command1 = getSubCommand("c1", [], []);
    const command2 = getSubCommand("c1", [], []);
    const commandRegistry = new DefaultCommandRegistry();

    commandRegistry.addCommand(command1);
    expect(() => commandRegistry.addCommand(command2)).toThrow();
  });

  test("Check for duplicate sub-command and group command name", () => {
    const command1 = getGroupCommand("c1");
    const command2 = getSubCommand("c1", [], []);
    const commandRegistry = new DefaultCommandRegistry();

    commandRegistry.addCommand(command1);
    expect(() => commandRegistry.addCommand(command2)).toThrow();
  });

  test("Check for duplicate global command name", () => {
    const command1 = getGlobalCommand("c1");
    const command2 = getGlobalCommand("c1");
    const commandRegistry = new DefaultCommandRegistry();

    commandRegistry.addCommand(command1);
    expect(() => commandRegistry.addCommand(command2)).toThrow();
  });

  test("Allow duplicate command name between sub-command and global command", () => {
    const subCommand = getSubCommand("c1", [], []);
    const globalCommand = getGlobalCommand("c1");
    const commandRegistry = new DefaultCommandRegistry();

    commandRegistry.addCommand(subCommand);
    commandRegistry.addCommand(globalCommand);
  });

  test("Getters work as expected", () => {
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

    expect(
      commandRegistry.getSubCommandByName(subCommand2.name)!.name,
    ).toEqual(
      subCommand2.name,
    );
    expect(
      commandRegistry.getGroupCommandByName(groupCommand2.name)!.name,
    ).toEqual(
      groupCommand2.name,
    );
    expect(
      commandRegistry.getGlobalCommandByName(globalCommand2.name)!.name,
    ).toEqual(
      globalCommand2.name,
    );
    expect(
      commandRegistry.getGlobalModifierCommandByName(
        globalModifierCommand2.name,
      )!.name,
    ).toEqual(
      globalModifierCommand2.name,
    );

    const result1 = commandRegistry
      .getGroupCommandAndMemberSubCommandByJoinedName(
        `${groupCommand2.name}:${memberSubCommand2.name}`,
      );

    expect(result1!.groupCommand.name).toEqual(groupCommand2.name);
    expect(result1!.command.name).toEqual(memberSubCommand2.name);

    const result2 = commandRegistry.getGroupAndMemberCommandsByJoinedName();
    const result3 = result2!.get(
      `${groupCommand2.name}:${memberSubCommand2.name}`,
    );

    expect(result3!.groupCommand.name).toEqual(groupCommand2.name);
    expect(result3!.command.name).toEqual(memberSubCommand2.name);

    const result4 = commandRegistry
      .getGlobalModifierCommandsByNameNotProvidedByService();
    const result5 = result4!.get(globalModifierCommand2.name);

    expect(result5!.name).toEqual(globalModifierCommand2.name);

    const result6 = commandRegistry
      .getGlobalModifierCommandsByShortAliasNotProvidedByService();
    const result7 = result6!.get(globalModifierCommand2.shortAlias!);

    expect(result7!.name).toEqual(globalModifierCommand2.name);

    const result8 = commandRegistry.getGlobalCommandsByShortAlias();
    const result9 = result8!.get(globalCommand2.shortAlias!);

    expect(result9!.name).toEqual(globalCommand2.name);

    const result10 = commandRegistry.getNonModifierCommandsByName();
    const result11 = result10!.get(subCommand2.name);
    const result12 = result10!.get(globalCommand2.name);

    expect(result11!.name).toEqual(subCommand2.name);
    expect(result12!.name).toEqual(globalCommand2.name);

    const result13 = commandRegistry
      .getGlobalModifierCommandsByNameProvidedByService(service1Id);
    const result14 = result13!.get(globalModifierCommand3.name);

    expect(result14!.name).toEqual(globalModifierCommand3.name);

    const result15 = commandRegistry
      .getGlobalModifierCommandsByShortAliasProvidedByService(service2Id);
    const result16 = result15!.get(globalModifierCommand4.shortAlias!);

    expect(result16!.name).toEqual(globalModifierCommand4.name);
  });
});
