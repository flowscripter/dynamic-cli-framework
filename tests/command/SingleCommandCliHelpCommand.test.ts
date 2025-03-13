import { describe, test } from "bun:test";
import { getCommandRegistry } from "../fixtures/CommandRegistry.ts";
import {
  getGlobalCommand,
  getGlobalModifierCommand,
  getSubCommandWithOption,
  getSubCommandWithPositional,
} from "../fixtures/Command.ts";
import { getContext } from "../fixtures/Context.ts";
import {
  expectStringIncludes,
  expectStringNotIncludes,
} from "../fixtures/util.ts";
import { ArgumentValueTypeName } from "../../src/api/argument/ArgumentValueTypes.ts";
import { SingleCommandCliHelpGlobalCommand } from "../../src/command/SingleCommandCliHelpCommand.ts";
import type SubCommand from "../../src/api/command/SubCommand.ts";
import StreamString from "../fixtures/StreamString.ts";

describe("SingleCommandCliHelpCommand tests", () => {
  test("Ensure single command CLI with simple default command help is rendered correctly: simple default command", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption("command_a", true, true, true),
      getCommandRegistry(),
    );

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "--foo");
  });

  test("Ensure single command CLI aggregates all non-default command arguments", async () => {
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
      {
        name: "topic",
        helpTopic: "topic",
        options: [],
        positionals: [],
        execute: async (): Promise<void> => {},
      } as SubCommand,
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption("command_a", true, true, true),
      commandRegistry,
    );

    await help.execute(context);
    expectStringNotIncludes(streamString.getString(), "Global");
    expectStringNotIncludes(streamString.getString(), "Topic");
    expectStringIncludes(streamString.getString(), "Command Arguments");
    expectStringIncludes(streamString.getString(), "Other Arguments");
  });

  test("Ensure single command CLI with default and globals help is rendered correctly: default and global modifier", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1", "m", true, true),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption("command_a", true, true, true),
      commandRegistry,
    );

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "Other Arguments");
  });

  test("Ensure single command CLI with default and globals help is rendered correctly: default, global modifier and global", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getGlobalCommand("global1"),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption("command_a", true, true, true),
      commandRegistry,
    );
    await help.execute(context);
    expectStringIncludes(streamString.getString(), "Other Arguments");
  });

  test("Ensure single command CLI usage syntax is rendered correctly: simple default command", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption("command_a", true, true, true),
      getCommandRegistry(),
    );

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "foo --foo <string_value>...",
    );
  });

  test("Ensure single command CLI usage syntax is rendered correctly: simple default command with non-multiple arg", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry();
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption("command_a", true, true),
      commandRegistry,
    );

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "foo --foo <string_value>",
    );
  });

  test("Ensure single command CLI usage syntax is rendered correctly: simple default command with optional arg", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry();
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption("command_a", true),
      commandRegistry,
    );

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "foo [--foo <string_value>]",
    );
  });

  test("Ensure single command CLI usage syntax is rendered correctly: with mandatory arg global modifier", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1", "m", true, true),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption("command_a", true, true, true),
      commandRegistry,
    );

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "foo --foo <string_value>...",
    );
  });

  test("Ensure single command CLI usage syntax is rendered correctly: with global modifier with no arg", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption("command_a", true, true, true),
      commandRegistry,
    );

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "foo --foo <string_value>...",
    );
  });

  test("Ensure single command CLI usage syntax is rendered correctly: with singular optional arg and global modifier", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption("command_a", true),
      commandRegistry,
    );

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "foo [--foo <string_value>]",
    );
  });

  test("Ensure single command CLI usage syntax is rendered correctly: with multiple optional arg and multiple global modifiers and multiple global commands", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getGlobalModifierCommand("modifier2", "m", true, true),
      getGlobalCommand("global1", true, true),
      getGlobalCommand("global2", true, true),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption("command_a", true, false, true),
      commandRegistry,
    );

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "foo [--foo <string_value>]...",
    );
  });

  test("Ensure single command CLI usage syntax is rendered correctly: with optional arg, multiple global modifiers, multiple global commands, multiple sub-commands", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getGlobalModifierCommand("modifier2", "m", true, true),
      getGlobalCommand("global1", true, true),
      getGlobalCommand("global2", true, true),
      getSubCommandWithOption("sub1", true, true),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption("command_a", true, false, true),
      commandRegistry,
    );

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "foo [--foo <string_value>]...",
    );
  });

  test("Ensure single command CLI usage syntax is rendered correctly: also with boolean args", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getGlobalModifierCommand("modifier2", "m", true, true),
      getGlobalCommand("global1", true, true),
      getGlobalCommand("global2", true, true),
      getSubCommandWithOption(
        "sub1",
        true,
        true,
        false,
        ArgumentValueTypeName.BOOLEAN,
      ),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption(
        "command_a",
        true,
        false,
        true,
        ArgumentValueTypeName.BOOLEAN,
      ),
      commandRegistry,
    );

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "foo [--foo [true|false]]...",
    );
  });

  test("Ensure single command CLI usage syntax is rendered correctly: also with default value", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry();
    const help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithOption(
        "command_a",
        true,
        false,
        true,
        ArgumentValueTypeName.STRING,
        "foo",
      ),
      commandRegistry,
    );

    await help.execute(context);
    expectStringIncludes(
      streamString.getString(),
      "foo [--foo <string_value>]...",
    );
  });

  test("Ensure single command CLI usage syntax is rendered correctly: with positionals", async () => {
    const streamString = new StreamString();
    const context = getContext(streamString);
    const commandRegistry = getCommandRegistry();
    let help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithPositional("command_a"),
      commandRegistry,
    );

    await help.execute(context);
    expectStringIncludes(streamString.getString(), "foo <foo>");

    help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithPositional("command_a", true, true),
      commandRegistry,
    );
    await help.execute(context);
    expectStringIncludes(streamString.getString(), "foo [<foo>]...");

    help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithPositional(
        "command_a",
        true,
        true,
        ArgumentValueTypeName.BOOLEAN,
      ),
      commandRegistry,
    );
    await help.execute(context);
    expectStringIncludes(streamString.getString(), "foo [<foo>]...");

    help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithPositional(
        "command_a",
        true,
        true,
        ArgumentValueTypeName.STRING,
      ),
      commandRegistry,
    );
    await help.execute(context);
    expectStringIncludes(streamString.getString(), "foo [<foo>]...");

    help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithPositional(
        "command_a",
        false,
        false,
        ArgumentValueTypeName.STRING,
      ),
      commandRegistry,
    );
    await help.execute(context);
    expectStringIncludes(streamString.getString(), "foo <foo>");

    help = new SingleCommandCliHelpGlobalCommand(
      true,
      getSubCommandWithPositional(
        "command_a",
        false,
        true,
        ArgumentValueTypeName.BOOLEAN,
      ),
      commandRegistry,
    );
    await help.execute(context);
    expectStringIncludes(streamString.getString(), "foo <foo>...");
  });
});
