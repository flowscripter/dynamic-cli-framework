import { Buffer } from "@std/streams";
import { getCommandRegistry } from "../fixtures/CommandRegistry.ts";
import {
  getGlobalCommand,
  getGlobalModifierCommand,
  getSubCommandWithOption,
} from "../fixtures/Command.ts";
import {
  expectBufferStringIncludes,
  expectBufferStringNotIncludes,
} from "../fixtures/util.ts";
import { getContext } from "../fixtures/Context.ts";
import {
  MultiCommandCliHelpGlobalCommand,
  MultiCommandCliHelpSubCommand,
} from "../../src/command/MultiCommandCliHelpCommand.ts";
import type SubCommand from "../../src/api/command/SubCommand.ts";
import type GroupCommand from "../../src/api/command/GroupCommand.ts";
import { ArgumentValueTypeName } from "../../src/api/argument/ArgumentValueTypes.ts";

Deno.test("MultiCommandCliHelpGlobalCommand works", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
  const commandRegistry = getCommandRegistry();
  const help = new MultiCommandCliHelpGlobalCommand(
    true,
    commandRegistry,
  );

  commandRegistry.addCommand(help);

  await help.execute(context);
  expectBufferStringIncludes(buffer, "Usage");
  expectBufferStringIncludes(buffer, "foo <command>");
});

Deno.test("MultiCommandCliHelpSubCommand works", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
  const commandRegistry = getCommandRegistry();
  const help = new MultiCommandCliHelpSubCommand(
    true,
    commandRegistry,
  );

  commandRegistry.addCommand(help);

  await help.execute(context, {});
  expectBufferStringIncludes(buffer, "Usage");
  expectBufferStringIncludes(buffer, "foo <command>");
});

Deno.test("MultiCommandCliHelpGlobalCommand with command specified works", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
  const subCommand = getSubCommandWithOption("command_a");
  const commandRegistry = getCommandRegistry([subCommand]);
  const help = new MultiCommandCliHelpGlobalCommand(
    true,
    commandRegistry,
  );

  commandRegistry.addCommand(help);

  await help.execute(context, "command_a");
  expectBufferStringIncludes(buffer, "Usage");
  expectBufferStringIncludes(buffer, subCommand.description!);
});

Deno.test("MultiCommandCliHelpSubCommand with command specified works", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
  const subCommand = getSubCommandWithOption("command_a");
  const commandRegistry = getCommandRegistry([subCommand]);
  const help = new MultiCommandCliHelpSubCommand(
    true,
    commandRegistry,
  );

  commandRegistry.addCommand(help);

  await help.execute(context, { command: "command_a" });
  expectBufferStringIncludes(buffer, "Usage");
  expectBufferStringIncludes(buffer, subCommand.description!);
});

Deno.test("MultiCommandCliHelpGlobalCommand with unknown command specified error warning and generic help", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
  const commandRegistry = getCommandRegistry();
  const help = new MultiCommandCliHelpGlobalCommand(
    true,
    commandRegistry,
  );

  commandRegistry.addCommand(help);

  await help.execute(context, "hello");
  expectBufferStringIncludes(buffer, "Unknown command: hello");
  expectBufferStringIncludes(buffer, "Usage");
});

Deno.test("MultiCommandCliHelpSubCommand with unknown command specified displays error and generic help", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
  const commandRegistry = getCommandRegistry();
  const help = new MultiCommandCliHelpSubCommand(
    true,
    commandRegistry,
  );

  commandRegistry.addCommand(help);

  await help.execute(context, { command: "hello" });
  expectBufferStringIncludes(buffer, "Unknown command: hello");
  expectBufferStringIncludes(buffer, "Usage");
});

Deno.test("MultiCommandCliHelpSubCommand with mistyped command specified proposes matches", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(buffer, "Possible matches: command_a");
  expectBufferStringIncludes(buffer, "Unknown command: command_b");
  expectBufferStringIncludes(buffer, "Usage");
});

Deno.test("Ensure global options are ordered", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(buffer, "--aaa");
  expectBufferStringIncludes(buffer, "--zzz");
});

Deno.test("Ensure commands are sectioned by topic and group", async () => {
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
  expectBufferStringIncludes(buffer, "Topic");
  expectBufferStringIncludes(buffer, "Goo");
});

Deno.test("Ensure non-topic commands are referred to as 'Other Commands' if there are topic commands", async () => {
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
  expectBufferStringIncludes(buffer, "Other Commands");
  expectBufferStringIncludes(buffer, "Topic");
  expectBufferStringIncludes(buffer, "Goo");
});

Deno.test("Ensure non-topic commands are referred to as 'Other Commands' if there are group commands", async () => {
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
  expectBufferStringIncludes(buffer, "Other Commands");
  expectBufferStringIncludes(buffer, "Goo");
});

Deno.test("Ensure non-topic commands are referred to as 'Sub-Commands' if there are no topic and no group commands", async () => {
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
    true,
    commandRegistry,
  );

  commandRegistry.addCommand(help);

  await help.execute(context);
  expectBufferStringIncludes(buffer, "Sub-Commands");
});

Deno.test("Ensure global items are renamed without global if no sub or group commands", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(buffer, "<option>");
  expectBufferStringIncludes(buffer, "<command>");
  expectBufferStringIncludes(buffer, "Options");
  expectBufferStringIncludes(buffer, "Commands");
});

Deno.test("Ensure global items are named with global if sub commands", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(buffer, "<global_option>");
  expectBufferStringIncludes(buffer, "<global_command>");
  expectBufferStringIncludes(buffer, "Global Options");
  expectBufferStringIncludes(buffer, "Global Commands");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: do not render global_option if no global modifiers", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
  const commandRegistry = getCommandRegistry();
  const help = new MultiCommandCliHelpGlobalCommand(
    true,
    commandRegistry,
  );

  commandRegistry.addCommand(help);

  await help.execute(context);
  expectBufferStringIncludes(buffer, "foo");
  expectBufferStringNotIncludes(buffer, "global_option");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: render global_option arg if global modifiers defined", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(buffer, "[<global_option> [<value>]]...");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: do not render global_option multiplicity if only one defined", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(buffer, "[<global_option>] <global_command>");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: do not render global_option arg if none defined", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(buffer, "[<global_option>]... <global_command>");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: do not render global_option arg as optional if none are optional and have no default or not boolean", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(buffer, "[<global_option> <value>]");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: render global_option arg as optional if at least one modifier has no arg", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(buffer, "[<global_option> [<value>]]");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: do not render command if none defined (e.g. default command is configured)", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(buffer, "<option>]...");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: render command and global command", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
  const commandRegistry = getCommandRegistry([
    getSubCommandWithOption("command_a"),
  ]);
  const help = new MultiCommandCliHelpGlobalCommand(
    true,
    commandRegistry,
  );

  commandRegistry.addCommand(help);

  await help.execute(context);
  expectBufferStringIncludes(buffer, "<global_command>|<command>");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: do not render arg if none defined", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
  const commandRegistry = getCommandRegistry([
    getSubCommandWithOption("command_a"),
  ]);
  const help = new MultiCommandCliHelpGlobalCommand(
    true,
    commandRegistry,
  );

  commandRegistry.addCommand(help);

  await help.execute(context);
  expectBufferStringIncludes(buffer, "<command>");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: render arg if at least one defined", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
  const commandRegistry = getCommandRegistry([
    getSubCommandWithOption("command_a", true, true),
  ]);
  const help = new MultiCommandCliHelpGlobalCommand(
    true,
    commandRegistry,
  );

  commandRegistry.addCommand(help);

  await help.execute(context);
  expectBufferStringIncludes(buffer, "<command> [<arg>");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: render arg as optional if at least one is optional", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(buffer, "<command> [<arg> <value>]");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: render arg as multiple if at least one multiple", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(buffer, "<command> [<arg> <value>]...");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: do not render arg value in [] if none are optional and have no default or not boolean", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
  const commandRegistry = getCommandRegistry([
    getSubCommandWithOption("command_a", true, true, true),
    getSubCommandWithOption("command_b", true, true, true),
  ]);
  const help = new MultiCommandCliHelpGlobalCommand(
    true,
    commandRegistry,
  );

  await help.execute(context);
  expectBufferStringIncludes(buffer, "<command> <<arg> <value>>...");
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: multiple global and sub commands", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(
    buffer,
    "<global_command>|<command> [<arg> <value>]",
  );
});

Deno.test("Ensure multi-command CLI usage syntax is rendered correctly: multiple global and sub commands with multiple args and optional values", async () => {
  const buffer = new Buffer();
  const context = getContext(buffer);
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
  expectBufferStringIncludes(
    buffer,
    "<global_command>|<command> [<arg> [<value>]]...",
  );
});
