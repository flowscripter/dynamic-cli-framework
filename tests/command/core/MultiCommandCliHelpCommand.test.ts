import { Buffer, describe, it } from "../../test_deps.ts";
import {
  MultiCommandCliHelpGlobalCommand,
  MultiCommandCliHelpSubCommand,
} from "../../../src/command/core/MultiCommandCliHelpCommand.ts";
import {
  ArgumentValueTypeName,
  GroupCommand,
  SubCommand,
} from "../../../mod.ts";
import { getCommandRegistry } from "../../fixtures/CommandRegistry.ts";
import {
  getGlobalCommand,
  getGlobalModifierCommand,
  getSubCommand,
} from "../../fixtures/Command.ts";
import {
  expectBufferStringIncludes,
  expectBufferStringNotIncludes,
} from "../../fixtures/util.ts";
import { getContext } from "../../fixtures/Context.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

describe("MultiCommandCliHelpCommand", () => {
  it("MultiCommandCliHelpGlobalCommand works", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry();
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "Usage");
    expectBufferStringIncludes(buffer, "foo <command>");
  });

  it("MultiCommandCliHelpSubCommand works", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry();
    const help = new MultiCommandCliHelpSubCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "Usage");
    expectBufferStringIncludes(buffer, "foo <command>");
  });

  it("MultiCommandCliHelpGlobalCommand with command specified works", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const subCommand = getSubCommand("command_a");
    const commandRegistry = getCommandRegistry([subCommand]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({ help: "command_a" }, context);
    expectBufferStringIncludes(buffer, "Usage");
    expectBufferStringIncludes(buffer, subCommand.description!);
  });

  it("MultiCommandCliHelpSubCommand with command specified works", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const subCommand = getSubCommand("command_a");
    const commandRegistry = getCommandRegistry([subCommand]);
    const help = new MultiCommandCliHelpSubCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({ help: "command_a" }, context);
    expectBufferStringIncludes(buffer, "Usage");
    expectBufferStringIncludes(buffer, subCommand.description!);
  });

  it("MultiCommandCliHelpGlobalCommand with unknown command specified error warning and generic help", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry();
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({ help: "hello" }, context);
    expectBufferStringIncludes(buffer, "Unknown command: hello");
    expectBufferStringIncludes(buffer, "Usage");
  });

  it("MultiCommandCliHelpSubCommand with unknown command specified displays error and generic help", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry();
    const help = new MultiCommandCliHelpSubCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({ help: "hello" }, context);
    expectBufferStringIncludes(buffer, "Unknown command: hello");
    expectBufferStringIncludes(buffer, "Usage");
  });

  it("MultiCommandCliHelpSubCommand with mistyped command specified proposes matches", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getSubCommand("other1"),
      getSubCommand("command_a"),
      getSubCommand("other2"),
    ]);
    const help = new MultiCommandCliHelpSubCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({ help: "command_b" }, context);
    expectBufferStringIncludes(buffer, "Possible matches: command_a");
    expectBufferStringIncludes(buffer, "Unknown command: command_b");
    expectBufferStringIncludes(buffer, "Usage");
  });

  it("Ensure global options are ordered", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("zzz", true),
      getGlobalModifierCommand("aaa", true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "--aaa");
    expectBufferStringIncludes(buffer, "--zzz");
  });

  it("Ensure commands are sectioned by topic and group", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      {
        name: "topic",
        helpTopic: "topic",
        options: [],
        positionals: [],
        execute: async (): Promise<void> => {},
      } as SubCommand,
      {
        name: "goo",
        memberSubCommands: [getSubCommand("gar")],
        execute: async (): Promise<void> => {},
      } as GroupCommand,
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "Topic");
    expectBufferStringIncludes(buffer, "Goo");
  });

  it("Ensure non-topic commands are referred to as 'Other Commands' if there are topic commands", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      {
        name: "topic",
        helpTopic: "topic",
        options: [],
        positionals: [],
        execute: async (): Promise<void> => {},
      } as SubCommand,
      {
        name: "sub",
        options: [],
        positionals: [],
        execute: async (): Promise<void> => {},
      } as SubCommand,
      {
        name: "goo",
        memberSubCommands: [getSubCommand("gar")],
        execute: async (): Promise<void> => {},
      } as GroupCommand,
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "Other Commands");
    expectBufferStringIncludes(buffer, "Topic");
    expectBufferStringIncludes(buffer, "Goo");
  });

  it("Ensure non-topic commands are referred to as 'Other Commands' if there are group commands", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      {
        name: "sub",
        options: [],
        positionals: [],
        execute: async (): Promise<void> => {},
      } as SubCommand,
      {
        name: "goo",
        memberSubCommands: [getSubCommand("gar")],
        execute: async (): Promise<void> => {},
      } as GroupCommand,
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "Other Commands");
    expectBufferStringIncludes(buffer, "Goo");
  });

  it("Ensure non-topic commands are referred to as 'Sub-Commands' if there are no topic and no group commands", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      {
        name: "sub",
        options: [],
        positionals: [],
        execute: async (): Promise<void> => {},
      } as SubCommand,
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "Sub-Commands");
  });

  it("Ensure global items are renamed without global if no sub or group commands", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("zzz"),
      getGlobalModifierCommand("aaa"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "<option>");
    expectBufferStringIncludes(buffer, "<command>");
    expectBufferStringIncludes(buffer, "Options");
    expectBufferStringIncludes(buffer, "Commands");
  });

  it("Ensure global items are named with global if sub commands", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("zzz", true),
      getGlobalModifierCommand("aaa", true),
      getSubCommand("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "<global_option>");
    expectBufferStringIncludes(buffer, "<global_command>");
    expectBufferStringIncludes(buffer, "Global Options");
    expectBufferStringIncludes(buffer, "Global Commands");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: do not render global_option if no global modifiers", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry();
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo");
    expectBufferStringNotIncludes(buffer, "global_option");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: render global_option arg if global modifiers defined", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1", true),
      getGlobalModifierCommand("modifier2"),
      getSubCommand("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "[<global_option> [<value>]]...");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: do not render global_option multiplicity if only one defined", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getSubCommand("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "[<global_option>] <global_command>");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: do not render global_option arg if none defined", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getGlobalModifierCommand("modifier2"),
      getSubCommand("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "[<global_option>]... <global_command>");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: do not render global_option arg as optional if none are optional and have no default or not boolean", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1", true, true),
      getGlobalModifierCommand("modifier2", true, true),
      getSubCommand("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "[<global_option> <value>]");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: render global_option arg as optional if at least one modifier has no arg", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1", true, true),
      getGlobalModifierCommand("modifier2"),
      getSubCommand("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "[<global_option> [<value>]]");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: do not render command if none defined (e.g. default command is configured)", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getGlobalModifierCommand("modifier2"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "<option>]...");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: render command and global command", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getSubCommand("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "<global_command>|<command>");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: do not render arg if none defined", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getSubCommand("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "<command>");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: render arg if at least one defined", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getSubCommand("command_a", true, true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "<command> [<arg>");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: render arg as optional if at least one is optional", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getSubCommand("command_a", true, true),
      getSubCommand("command_b", true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "<command> [<arg> <value>]");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: render arg as multiple if at least one multiple", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getSubCommand("command_a", true, true, true),
      getSubCommand("command_b", true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "<command> [<arg> <value>]...");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: do not render arg value in [] if none are optional and have no default or not boolean", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getSubCommand("command_a", true, true, true),
      getSubCommand("command_b", true, true, true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "<command> <<arg> <value>>...");
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: multiple global and sub commands", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalCommand("global1", true, true),
      getGlobalCommand("global2", true),
      getSubCommand("command_a", true, true),
      getSubCommand("command_b", true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(
      buffer,
      "<global_command>|<command> [<arg> <value>]",
    );
  });

  it("Ensure multi-command CLI usage syntax is rendered correctly: multiple global and sub commands with multiple args and optional values", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalCommand("global1", true, true),
      getGlobalCommand("global2", true),
      getSubCommand(
        "command_a",
        true,
        true,
        true,
        ArgumentValueTypeName.BOOLEAN,
      ),
      getSubCommand("command_b", true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      getCLIConfig(),
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute({}, context);
    expectBufferStringIncludes(
      buffer,
      "<global_command>|<command> [<arg> [<value>]]...",
    );
  });
});
