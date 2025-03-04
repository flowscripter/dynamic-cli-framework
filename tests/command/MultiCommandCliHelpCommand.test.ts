import { describe, test } from "bun:test";
import { getCommandRegistry } from "../fixtures/CommandRegistry.ts";
import {
  getGlobalCommand,
  getGlobalModifierCommand,
  getSubCommandWithOption,
} from "../fixtures/Command.ts";
import {
  expectStringIncludes,
  expectStringNotIncludes,
} from "../fixtures/util.ts";
import { getContext } from "../fixtures/Context.ts";
import {
  MultiCommandCliHelpGlobalCommand,
  MultiCommandCliHelpSubCommand,
} from "../../src/command/MultiCommandCliHelpCommand.ts";
import type SubCommand from "../../src/api/command/SubCommand.ts";
import type GroupCommand from "../../src/api/command/GroupCommand.ts";
import { ArgumentValueTypeName } from "../../src/api/argument/ArgumentValueTypes.ts";
import StreamString from "../fixtures/StreamString.ts";

describe("MultiCommandCliHelpCommand Tests", () => {
  test("MultiCommandCliHelpGlobalCommand works", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry();
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    streamString.getString().includes;
    expectStringIncludes(streamString.getString(), "Usage");
    expectStringIncludes(streamString.getString(), "foo <command>");
  });

  test("MultiCommandCliHelpSubCommand works", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry();
    const help = new MultiCommandCliHelpSubCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context, {});
    expectStringIncludes(streamString.getString(), "Usage");
    expectStringIncludes(streamString.getString(), "foo <command>");
  });

  test("MultiCommandCliHelpGlobalCommand with command specified works", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const subCommand = getSubCommandWithOption("command_a");
    const commandRegistry = getCommandRegistry([subCommand]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context, "command_a");
    expectStringIncludes(streamString.getString(), "Usage");
    expectStringIncludes(
      streamString.getString(),
      subCommand.description!,
    );
  });

  test("MultiCommandCliHelpSubCommand with command specified works", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const subCommand = getSubCommandWithOption("command_a");
    const commandRegistry = getCommandRegistry([subCommand]);
    const help = new MultiCommandCliHelpSubCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context, { command: "command_a" });
    expectStringIncludes(streamString.getString(), "Usage");
    expectStringIncludes(
      streamString.getString(),
      subCommand.description!,
    );
  });

  test("MultiCommandCliHelpGlobalCommand with unknown command specified error warning and generic help", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry();
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context, "hello");
    expectStringIncludes(
      streamString.getString(),
      "Unknown command: hello",
    );
    expectStringIncludes(streamString.getString(), "Usage");
  });

  test("MultiCommandCliHelpSubCommand with unknown command specified displays error and generic help", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry();
    const help = new MultiCommandCliHelpSubCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context, { command: "hello" });
    expectStringIncludes(
      streamString.getString(),
      "Unknown command: hello",
    );
    expectStringIncludes(streamString.getString(), "Usage");
  });

  test("MultiCommandCliHelpSubCommand with mistyped command specified proposes matches", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getSubCommandWithOption("other1"),
      getSubCommandWithOption("command_a"),
      getSubCommandWithOption("other2"),
    ]);
    const help = new MultiCommandCliHelpSubCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context, { command: "command_b" });
    expectStringIncludes(
      streamString.getString(),
      "Possible matches: command_a",
    );
    expectStringIncludes(
      streamString.getString(),
      "Unknown command: command_b",
    );
    expectStringIncludes(streamString.getString(), "Usage");
  });

  test("Ensure global options are ordered", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("zzz", "z", true),
      getGlobalModifierCommand("aaa", "a", true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "--aaa");
    expectStringIncludes(streamString.getString(), "--zzz");
  });

  test("Ensure commands are sectioned by topic and group", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
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
        memberSubCommands: [getSubCommandWithOption("gar")],
        execute: async (): Promise<void> => {},
      } as GroupCommand,
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "Topic");
    expectStringIncludes(streamString.getString(), "Goo");
  });

  test("Ensure non-topic commands are referred to as 'Other Commands' if there are topic commands", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
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
        memberSubCommands: [getSubCommandWithOption("gar")],
        execute: async (): Promise<void> => {},
      } as GroupCommand,
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "Other Commands");
    expectStringIncludes(streamString.getString(), "Topic");
    expectStringIncludes(streamString.getString(), "Goo");
  });

  test("Ensure non-topic commands are referred to as 'Other Commands' if there are group commands", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      {
        name: "sub",
        options: [],
        positionals: [],
        execute: async (): Promise<void> => {},
      } as SubCommand,
      {
        name: "goo",
        memberSubCommands: [getSubCommandWithOption("gar")],
        execute: async (): Promise<void> => {},
      } as GroupCommand,
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "Other Commands");
    expectStringIncludes(streamString.getString(), "Goo");
  });

  test("Ensure non-topic commands are referred to as 'Sub-Commands' if there are no topic and no group commands", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      {
        name: "sub",
        options: [],
        positionals: [],
        execute: async (): Promise<void> => {},
      } as SubCommand,
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "Sub-Commands");
  });

  test("Ensure global items are renamed without global if no sub or group commands", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("zzz"),
      getGlobalModifierCommand("aaa"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "<option>");
    expectStringIncludes(streamString.getString(), "<command>");
    expectStringIncludes(streamString.getString(), "Options");
    expectStringIncludes(streamString.getString(), "Commands");
  });

  test("Ensure global items are named with global if sub commands", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("zzz", "z", true),
      getGlobalModifierCommand("aaa", "a", true),
      getSubCommandWithOption("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "<global_option>");
    expectStringIncludes(streamString.getString(), "<global_command>");
    expectStringIncludes(streamString.getString(), "Global Options");
    expectStringIncludes(streamString.getString(), "Global Commands");
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: do not render global_option if no global modifiers", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry();
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "foo");
    expectStringNotIncludes(
      streamString.getString(),
      "global_option",
    );
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: render global_option arg if global modifiers defined", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1", "m", true),
      getGlobalModifierCommand("modifier2"),
      getSubCommandWithOption("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "[<global_option> [<value>]]...",
    );
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: do not render global_option multiplicity if only one defined", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getSubCommandWithOption("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "[<global_option>] <global_command>",
    );
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: do not render global_option arg if none defined", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getGlobalModifierCommand("modifier2"),
      getSubCommandWithOption("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "[<global_option>]... <global_command>",
    );
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: do not render global_option arg as optional if none are optional and have no default or not boolean", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1", "1", true, true),
      getGlobalModifierCommand("modifier2", "2", true, true),
      getSubCommandWithOption("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "[<global_option> <value>]",
    );
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: render global_option arg as optional if at least one modifier has no arg", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1", "m", true, true),
      getGlobalModifierCommand("modifier2"),
      getSubCommandWithOption("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "[<global_option> [<value>]]",
    );
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: do not render command if none defined (e.g. default command is configured)", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getGlobalModifierCommand("modifier2"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "<option>]...");
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: render command and global command", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getSubCommandWithOption("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "<global_command>|<command>",
    );
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: do not render arg if none defined", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getSubCommandWithOption("command_a"),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "<command>");
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: render arg if at least one defined", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getSubCommandWithOption("command_a", true, true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "<command> [<arg>");
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: render arg as optional if at least one is optional", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getSubCommandWithOption("command_a", true, true),
      getSubCommandWithOption("command_b", true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "<command> [<arg> <value>]",
    );
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: render arg as multiple if at least one multiple", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getSubCommandWithOption("command_a", true, true, true),
      getSubCommandWithOption("command_b", true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "<command> [<arg> <value>]...",
    );
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: do not render arg value in [] if none are optional and have no default or not boolean", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getSubCommandWithOption("command_a", true, true, true),
      getSubCommandWithOption("command_b", true, true, true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "<command> <<arg> <value>>...",
    );
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: multiple global and sub commands", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalCommand("global1", true, true),
      getGlobalCommand("global2", true),
      getSubCommandWithOption("command_a", true, true),
      getSubCommandWithOption("command_b", true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "<global_command>|<command> [<arg> <value>]",
    );
  });

  test("Ensure multi-command CLI usage syntax is rendered correctly: multiple global and sub commands with multiple args and optional values", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalCommand("global1", true, true),
      getGlobalCommand("global2", true),
      getSubCommandWithOption(
        "command_a",
        true,
        true,
        true,
        ArgumentValueTypeName.BOOLEAN,
      ),
      getSubCommandWithOption("command_b", true),
    ]);
    const help = new MultiCommandCliHelpGlobalCommand(
      true,
      commandRegistry,
    );

    commandRegistry.addCommand(help);

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "<global_command>|<command> [<arg> [<value>]]...",
    );
  });
});
