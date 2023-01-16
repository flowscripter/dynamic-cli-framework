import { Buffer, describe, it } from "../../test_deps.ts";
import { ArgumentValueTypeName, SubCommand } from "../../../mod.ts";
import { SingleCommandCliHelpGlobalCommand } from "../../../src/command/core/SingleCommandCliHelpCommand.ts";
import { getCommandRegistry } from "../../fixtures/CommandRegistry.ts";
import {
  getGlobalCommand,
  getGlobalModifierCommand,
  getPositionalSubCommand,
  getSubCommand,
} from "../../fixtures/Command.ts";
import { getContext } from "../../fixtures/Context.ts";
import {
  expectBufferStringIncludes,
  expectBufferStringNotIncludes,
} from "../../fixtures/util.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

describe("SingleCommandCliHelpCommand", () => {
  it("Ensure single command CLI with simple default command help is rendered correctly: simple default command", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand("command_a", true, true, true),
      getCommandRegistry(),
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "--foo");
  });

  it("Ensure single command CLI aggregates all non-default command arguments", async () => {
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
      {
        name: "topic",
        helpTopic: "topic",
        options: [],
        positionals: [],
        execute: async (): Promise<void> => {},
      } as SubCommand,
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand("command_a", true, true, true),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringNotIncludes(buffer, "Global");
    expectBufferStringNotIncludes(buffer, "Topic");
    expectBufferStringIncludes(buffer, "Command Arguments");
    expectBufferStringIncludes(buffer, "Other Arguments");
  });

  it("Ensure single command CLI with default and globals help is rendered correctly: default and global modifier", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1", true, true),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand("command_a", true, true, true),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "Other Arguments");
  });

  it("Ensure single command CLI with default and globals help is rendered correctly: default, global modifier and global", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getGlobalCommand("global1"),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand("command_a", true, true, true),
      commandRegistry,
    );
    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "Other Arguments");
  });

  it("Ensure single command CLI usage syntax is rendered correctly: simple default command", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand("command_a", true, true, true),
      getCommandRegistry(),
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo --foo <string_value>...");
  });

  it("Ensure single command CLI usage syntax is rendered correctly: simple default command with non-multiple arg", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry();
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand("command_a", true, true),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo --foo <string_value>");
  });

  it("Ensure single command CLI usage syntax is rendered correctly: simple default command with optional arg", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry();
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand("command_a", true),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo [--foo <string_value>]");
  });

  it("Ensure single command CLI usage syntax is rendered correctly: with mandatory arg global modifier", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1", true, true),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand("command_a", true, true, true),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo --foo <string_value>...");
  });

  it("Ensure single command CLI usage syntax is rendered correctly: with global modifier with no arg", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand("command_a", true, true, true),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo --foo <string_value>...");
  });

  it("Ensure single command CLI usage syntax is rendered correctly: with singular optional arg and global modifier", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand("command_a", true),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo [--foo <string_value>]");
  });

  it("Ensure single command CLI usage syntax is rendered correctly: with multiple optional arg and multiple global modifiers and multiple global commands", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getGlobalModifierCommand("modifier2", true, true),
      getGlobalCommand("global1", true, true),
      getGlobalCommand("global2", true, true),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand("command_a", true, false, true),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo [--foo <string_value>]...");
  });

  it("Ensure single command CLI usage syntax is rendered correctly: with optional arg, multiple global modifiers, multiple global commands, multiple sub-commands", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getGlobalModifierCommand("modifier2", true, true),
      getGlobalCommand("global1", true, true),
      getGlobalCommand("global2", true, true),
      getSubCommand("sub1", true, true),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand("command_a", true, false, true),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo [--foo <string_value>]...");
  });

  it("Ensure single command CLI usage syntax is rendered correctly: also with boolean args", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry([
      getGlobalModifierCommand("modifier1"),
      getGlobalModifierCommand("modifier2", true, true),
      getGlobalCommand("global1", true, true),
      getGlobalCommand("global2", true, true),
      getSubCommand("sub1", true, true, false, ArgumentValueTypeName.BOOLEAN),
    ]);
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand(
        "command_a",
        true,
        false,
        true,
        ArgumentValueTypeName.BOOLEAN,
      ),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo [--foo [true|false]]...");
  });

  it("Ensure single command CLI usage syntax is rendered correctly: also with default value", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry();
    const help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getSubCommand(
        "command_a",
        true,
        false,
        true,
        ArgumentValueTypeName.STRING,
        "foo",
      ),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo [--foo <string_value>]...");
  });

  it("Ensure single command CLI usage syntax is rendered correctly: with positionals", async () => {
    const buffer = new Buffer();
    const context = getContext(buffer);
    const commandRegistry = getCommandRegistry();
    let help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getPositionalSubCommand("command_a"),
      commandRegistry,
    );

    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo <foo>");

    help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getPositionalSubCommand("command_a", true, true),
      commandRegistry,
    );
    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo [<foo>]...");

    help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getPositionalSubCommand(
        "command_a",
        true,
        true,
        ArgumentValueTypeName.BOOLEAN,
      ),
      commandRegistry,
    );
    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo [<foo>]...");

    help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getPositionalSubCommand(
        "command_a",
        true,
        true,
        ArgumentValueTypeName.STRING,
      ),
      commandRegistry,
    );
    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo [<foo>]...");

    help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getPositionalSubCommand(
        "command_a",
        false,
        false,
        ArgumentValueTypeName.STRING,
      ),
      commandRegistry,
    );
    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo <foo>");

    help = new SingleCommandCliHelpGlobalCommand(
      getCLIConfig(),
      getPositionalSubCommand(
        "command_a",
        false,
        true,
        ArgumentValueTypeName.BOOLEAN,
      ),
      commandRegistry,
    );
    await help.execute({}, context);
    expectBufferStringIncludes(buffer, "foo <foo>...");
  });
});
