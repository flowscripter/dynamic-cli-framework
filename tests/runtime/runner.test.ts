import { describe, expect, test } from "bun:test";
import DefaultCommandRegistry from "../../src/runtime/registry/DefaultCommandRegistry.ts";
import {
  getGlobalCommandWithShortAlias,
  getGlobalModifierCommandWithArgument,
  getGroupCommand,
  getSubCommand,
  getSubCommandWithOption,
} from "../fixtures/Command.ts";
import { run } from "../../src/runtime/runner.ts";
import { RunState } from "../../src/api/RunResult.ts";
import { getContext } from "../fixtures/Context.ts";
import { getServiceProviderRegistry } from "../fixtures/ServiceProviderRegistry.ts";
import { expectStringIncludes } from "../fixtures/util.ts";
import { getConfigurationServiceProvider } from "../fixtures/ConfigurationServiceProvider.ts";
import type GlobalModifierCommand from "../../src/api/command/GlobalModifierCommand.ts";
import {
  type ArgumentSingleValueType,
  type ArgumentValues,
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "../../src/api/argument/ArgumentValueTypes.ts";
import WritableStreamString from "../fixtures/StreamString.ts";
import StreamString from "../fixtures/StreamString.ts";
describe("runner Tests", () => {
  test("Sub-Command run", async () => {
    let hasRun = false;

    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    };
    const command = getSubCommand("command", [option]);

    command.execute = (): Promise<void> => {
      hasRun = true;

      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([command]);

    const runResult = await run(
      ["command", "--foo", "bar"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(hasRun).toBeTrue();
  });

  test("Global Modifier run", async () => {
    let modifierHasRun = false;
    let subHasRun = false;

    const globalModifierCommand = getGlobalModifierCommandWithArgument(
      "modifierCommand",
      "c",
      1,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const subCommand = getSubCommand("subCommand", [], []);

    globalModifierCommand.execute = (): Promise<void> => {
      modifierHasRun = true;
      return Promise.resolve();
    };
    subCommand.execute = (): Promise<void> => {
      subHasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([
      globalModifierCommand,
      subCommand,
    ]);
    let runResult = await run(
      ["--modifierCommand=bar", "subCommand"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(modifierHasRun).toBeTrue();
    expect(subHasRun).toBeTrue();

    modifierHasRun = false;
    subHasRun = false;

    runResult = await run(
      ["-c", "bar", "subCommand"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(modifierHasRun).toBeTrue();
    expect(subHasRun).toBeTrue();
  });

  test("Global Command run", async () => {
    let hasRun = false;

    const command = getGlobalCommandWithShortAlias("command", "c", {
      type: ArgumentValueTypeName.STRING,
    });

    command.execute = (): Promise<void> => {
      hasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([command]);
    let runResult = await run(
      ["--command=bar"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(hasRun).toBeTrue();

    hasRun = false;

    runResult = await run(
      ["-c", "bar"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(hasRun).toBeTrue();
  });

  test("Group Command run", async () => {
    let subHasRun = false;
    let groupHasRun = false;

    const subCommand = getSubCommand("command", [], []);
    const groupCommand = getGroupCommand("group", [subCommand]);

    subCommand.execute = (): Promise<void> => {
      subHasRun = true;
      return Promise.resolve();
    };
    groupCommand.execute = (): Promise<void> => {
      groupHasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([groupCommand]);
    let runResult = await run(
      ["group", "command"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(groupHasRun).toBeTrue();
    expect(subHasRun).toBeTrue();

    runResult = await run(
      ["group:command"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(groupHasRun).toBeTrue();
    expect(subHasRun).toBeTrue();
  });

  test("Global modifier and sub-command run", async () => {
    let modifierHasRun = false;
    let subHasRun = false;

    const modifierCommand = getGlobalModifierCommandWithArgument(
      "modifier",
      "m",
      1,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);

    modifierCommand.execute = (): Promise<void> => {
      modifierHasRun = true;
      return Promise.resolve();
    };
    subCommand.execute = (): Promise<void> => {
      subHasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([
      modifierCommand,
      subCommand,
    ]);
    const runResult = await run(
      ["--modifier=bar", "command", "--foo", "bar"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(modifierHasRun).toBeTrue();
    expect(subHasRun).toBeTrue();
  });

  test("Global modifier and global run", async () => {
    let modifierHasRun = false;
    let globalHasRun = false;

    const modifierCommand = getGlobalModifierCommandWithArgument(
      "modifier",
      "m",
      1,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const globalCommand = getGlobalCommandWithShortAlias("global", "g", {
      type: ArgumentValueTypeName.STRING,
    });

    modifierCommand.execute = (): Promise<void> => {
      modifierHasRun = true;
      return Promise.resolve();
    };
    globalCommand.execute = (): Promise<void> => {
      globalHasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([
      modifierCommand,
      globalCommand,
    ]);
    const runResult = await run(
      ["--modifier=bar", "-g", "bar"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(modifierHasRun).toBeTrue();
    expect(globalHasRun).toBeTrue();
  });

  test("Two global modifier and global run", async () => {
    let modifier1HasRun = false;
    let modifier2HasRun = false;
    let globalHasRun = false;

    const modifierCommand1 = getGlobalModifierCommandWithArgument(
      "modifier1",
      "m",
      1,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const modifierCommand2 = getGlobalModifierCommandWithArgument(
      "modifier2",
      "n",
      2,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const globalCommand = getGlobalCommandWithShortAlias("global", "g", {
      type: ArgumentValueTypeName.STRING,
    });

    modifierCommand1.execute = (): Promise<void> => {
      modifier1HasRun = true;
      return Promise.resolve();
    };
    modifierCommand2.execute = (): Promise<void> => {
      modifier2HasRun = true;
      return Promise.resolve();
    };
    globalCommand.execute = (): Promise<void> => {
      globalHasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([
      modifierCommand1,
      modifierCommand2,
      globalCommand,
    ]);
    const runResult = await run(
      ["--modifier1=bar", "-g", "bar", "--modifier2=bar"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(modifier1HasRun).toBeTrue();
    expect(modifier2HasRun).toBeTrue();
    expect(globalHasRun).toBeTrue();
  });

  test("Two global modifier and group command run", async () => {
    let modifier1HasRun = false;
    let modifier2HasRun = false;
    let groupHasRun = false;
    let subHasRun = false;

    const modifierCommand1 = getGlobalModifierCommandWithArgument(
      "modifier1",
      "m",
      1,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const modifierCommand2 = getGlobalModifierCommandWithArgument(
      "modifier2",
      "n",
      2,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const subCommand = getSubCommandWithOption("subCommand", true);
    const groupCommand = getGroupCommand("group", [subCommand]);

    modifierCommand1.execute = (_context, argumentValue): Promise<void> => {
      expect(argumentValue).toEqual("bar1");
      modifier1HasRun = true;
      return Promise.resolve();
    };
    modifierCommand2.execute = (_context, argumentValue): Promise<void> => {
      expect(argumentValue).toEqual("bar2");
      modifier2HasRun = true;
      return Promise.resolve();
    };
    groupCommand.execute = (): Promise<void> => {
      groupHasRun = true;
      return Promise.resolve();
    };
    subCommand.execute = (_context, argumentValues): Promise<void> => {
      expect(argumentValues.foo).toEqual("subfoo");
      subHasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([
      modifierCommand1,
      modifierCommand2,
      groupCommand,
    ]);
    const runResult = await run(
      [
        "--modifier1=bar1",
        "group",
        "subCommand",
        "--foo",
        "subfoo",
        "--modifier2=bar2",
      ],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(modifier1HasRun).toBeTrue();
    expect(modifier2HasRun).toBeTrue();
    expect(groupHasRun).toBeTrue();
    expect(subHasRun).toBeTrue();
  });

  test("Global modifier and default run", async () => {
    let modifierHasRun = false;
    let defaultHasRun = false;

    const modifierCommand = getGlobalModifierCommandWithArgument(
      "modifier",
      "m",
      1,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const globalCommand = getGlobalCommandWithShortAlias("global", "g");

    modifierCommand.execute = (): Promise<void> => {
      modifierHasRun = true;
      return Promise.resolve();
    };
    globalCommand.execute = (): Promise<void> => {
      defaultHasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([
      modifierCommand,
      globalCommand,
    ]);
    const runResult = await run(
      ["--modifier=bar"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
      globalCommand,
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(modifierHasRun).toBeTrue();
    expect(defaultHasRun).toBeTrue();
  });

  test("Global modifier parse error", async () => {
    const streamString = new StreamString();

    let modifierHasRun = false;
    let defaultHasRun = false;

    const modifierCommand = getGlobalModifierCommandWithArgument(
      "modifier",
      "m",
      1,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const globalCommand = getGlobalCommandWithShortAlias("global", "g");

    modifierCommand.execute = (): Promise<void> => {
      modifierHasRun = true;
      return Promise.resolve();
    };
    globalCommand.execute = (): Promise<void> => {
      defaultHasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([
      modifierCommand,
      globalCommand,
    ]);
    const runResult = await run(
      ["--modifier"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
      globalCommand,
    );

    expect(runResult.runState).toEqual(RunState.PARSE_ERROR);
    expectStringIncludes(streamString.getString(), "(missing value)");
    expect(modifierHasRun).toBeFalse();
    expect(defaultHasRun).toBeFalse();
  });

  test("Default run", async () => {
    let subHasRun = false;

    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);

    subCommand.execute = (): Promise<void> => {
      subHasRun = true;
      return Promise.resolve();
    };

    const runResult = await run(
      ["--foo=bar"],
      new DefaultCommandRegistry([]),
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
      subCommand,
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(subHasRun).toBeTrue();
  });

  test("Error thrown in non-global run", async () => {
    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);

    subCommand.execute = (): Promise<void> => {
      throw new Error("d34db33f");
    };

    const commandRegistry = new DefaultCommandRegistry([subCommand]);
    const runResult = await run(
      ["command", "--foo", "bar"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.EXECUTION_ERROR);
  });

  test("Error thrown in global run", async () => {
    const streamString = new StreamString();
    const globalCommand = getGlobalCommandWithShortAlias("global", "g", {
      type: ArgumentValueTypeName.STRING,
    });

    globalCommand.execute = (): Promise<void> => {
      throw new Error("d34db33f");
    };

    const commandRegistry = new DefaultCommandRegistry([globalCommand]);
    const runResult = await run(
      ["--global=bar"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
    );

    expect(runResult.runState).toEqual(RunState.EXECUTION_ERROR);
    expectStringIncludes(streamString.getString(), "Execution error");
    expectStringIncludes(streamString.getString(), "d34db33f");
  });

  test("Error thrown in global modifier run", async () => {
    const streamString = new StreamString();

    let globalHasRun = false;

    const globalModifierCommand = getGlobalModifierCommandWithArgument(
      "modifier",
      "m",
      1,
    );
    const globalCommand = getGlobalCommandWithShortAlias("global", "g");

    globalModifierCommand.execute = (): Promise<void> => {
      throw new Error("d34db33f");
    };
    globalCommand.execute = (): Promise<void> => {
      globalHasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([
      globalCommand,
      globalModifierCommand,
    ]);
    const runResult = await run(
      ["--global", "--modifier"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
    );

    expect(runResult.runState).toEqual(RunState.EXECUTION_ERROR);
    expectStringIncludes(streamString.getString(), "Execution error");
    expectStringIncludes(streamString.getString(), "d34db33f");
    expect(globalHasRun).toBeFalse();
  });

  test("Parse error warning in non-global run", async () => {
    const streamString = new StreamString();
    let hasRun = false;
    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);

    subCommand.execute = (): Promise<void> => {
      hasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([subCommand]);
    const runResult = await run(
      ["command", "-f"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
    );

    expect(runResult.runState).toEqual(RunState.PARSE_ERROR);
    expectStringIncludes(
      streamString.getString(),
      "-f (missing value)",
    );
    expect(hasRun).toBeFalse();
  });

  test("Missing Group Command member", async () => {
    const subCommand = getSubCommand("command", [], []);
    const groupCommand = getGroupCommand("group", [subCommand]);

    subCommand.execute = (): Promise<void> => {
      return Promise.resolve();
    };
    groupCommand.execute = (): Promise<void> => {
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([groupCommand]);
    const runResult = await run(
      ["group", "wrongcommand"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.NO_COMMAND);
  });

  test("No command specified", async () => {
    const streamString = new StreamString();
    let hasRun = false;
    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);

    subCommand.execute = (): Promise<void> => {
      hasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([subCommand]);
    const runResult = await run(
      [],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
    );

    expect(runResult.runState).toEqual(RunState.NO_COMMAND);
    expectStringIncludes(
      streamString.getString(),
      "No command specified",
    );
    expect(hasRun).toBeFalse();
  });

  test("Unknown arg warning in non-global run", async () => {
    const streamString = new StreamString();
    let hasRun = false;
    const subCommand = getSubCommand("command", [], []);

    subCommand.execute = (): Promise<void> => {
      hasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([subCommand]);
    const runResult = await run(
      ["command", "-bad"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expectStringIncludes(streamString.getString(), "Unused arg: -bad");
    expect(hasRun).toBeTrue();
  });

  test("Unknown arg warning in global run", async () => {
    const streamString = new StreamString();
    let hasRun = false;

    const globalCommand = getGlobalCommandWithShortAlias("global", "g");

    globalCommand.execute = (): Promise<void> => {
      hasRun = true;
      return Promise.resolve();
    };

    const runResult = await run(
      ["--bad"],
      new DefaultCommandRegistry([]),
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
      globalCommand,
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expectStringIncludes(streamString.getString(), "Unused arg: --bad");
    expect(hasRun).toBeTrue();
  });

  test("Error thrown for default run", async () => {
    const streamString = new StreamString();
    const globalCommand = getGlobalCommandWithShortAlias("global", "g");

    globalCommand.execute = (): Promise<void> => {
      throw new Error("d34db33f");
    };

    const runResult = await run(
      [],
      new DefaultCommandRegistry([]),
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
      globalCommand,
    );

    expect(runResult.runState).toEqual(RunState.EXECUTION_ERROR);
    expectStringIncludes(streamString.getString(), "Execution error:");
    expectStringIncludes(streamString.getString(), "d34db33f");
  });

  test("Run default based on all args", async () => {
    const command = getSubCommand("command", [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "goo",
      type: ArgumentValueTypeName.STRING,
    }], []);
    const runResult = await run(
      ["--foo=f", "--goo=g"],
      new DefaultCommandRegistry([]),
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
      command,
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
  });

  test("Run default command based on config only and treating all args as unused", async () => {
    const streamString = new StreamString();
    const command = getSubCommand(
      "command",
      [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "goo",
        type: ArgumentValueTypeName.STRING,
      }],
      [],
      true,
    );
    const runResult = await run(
      ["--bip=b", "--bop=b"],
      new DefaultCommandRegistry([]),
      getServiceProviderRegistry(),
      getConfigurationServiceProvider(
        90,
        new Map([
          ["command", {
            foo: "f",
            goo: "g",
          }],
        ]),
      ),
      getContext(streamString),
      command,
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expectStringIncludes(
      streamString.getString(),
      "Unused args: --bip=b --bop=b",
    );
  });

  test("Run default command based on some args and treating some args as unused", async () => {
    const streamString = new StreamString();
    const command = getSubCommand(
      "command",
      [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "goo",
        type: ArgumentValueTypeName.STRING,
      }],
      [],
      true,
    );

    const runResult = await run(
      ["--bip=b", "--goo=g"],
      new DefaultCommandRegistry([]),
      getServiceProviderRegistry(),
      getConfigurationServiceProvider(
        90,
        new Map([
          ["command", {
            foo: "f",
          }],
        ]),
      ),
      getContext(streamString),
      command,
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expectStringIncludes(
      streamString.getString(),
      "Unused arg: --bip=b",
    );
  });

  test("Fail to parse default command with some unused args and missing required values", async () => {
    const streamString = new StreamString();
    const command = getSubCommand("command", [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "goo",
      type: ArgumentValueTypeName.STRING,
    }], []);

    const runResult = await run(
      ["--bip=b", "--goo=g"],
      new DefaultCommandRegistry([]),
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
      command,
    );
    expect(runResult.runState).toEqual(RunState.PARSE_ERROR);
    expectStringIncludes(streamString.getString(), "missing value");
  });

  test("Fail to parse default command with some unused args", async () => {
    const streamString = new StreamString();
    const command = getSubCommand("command", [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      isOptional: true,
    }, {
      name: "goo",
      type: ArgumentValueTypeName.STRING,
    }], []);

    const runResult = await run(
      ["--bip=b", "--goo=g"],
      new DefaultCommandRegistry([]),
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
      command,
    );
    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expectStringIncludes(streamString.getString(), "Unused arg");
  });

  test("Illegal second command treated as unknown arg", async () => {
    const streamString = new StreamString();
    let hasRun = false;
    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand1 = getSubCommand("command1", [option], []);

    subCommand1.execute = (): Promise<void> => {
      hasRun = true;
      return Promise.resolve();
    };

    const subCommand2 = getSubCommand("command2", [], []);
    const commandRegistry = new DefaultCommandRegistry([
      subCommand1,
      subCommand2,
    ]);
    const runResult = await run(
      ["command1", "--foo", "bar", "command2"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expectStringIncludes(
      streamString.getString(),
      "Unused arg: command2",
    );
    expect(hasRun).toBeTrue();
  });

  test("Ensure global modifier and global run priority order", async () => {
    const hasRun: string[] = [];
    const modifier1Command = getGlobalModifierCommandWithArgument(
      "modifier1",
      "1",
      2,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const modifier2Command = getGlobalModifierCommandWithArgument(
      "modifier2",
      "2",
      1,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const globalCommand = getGlobalCommandWithShortAlias("global", "g", {
      type: ArgumentValueTypeName.STRING,
    });

    modifier1Command.execute = (): Promise<void> => {
      hasRun.push(modifier1Command.name);
      return Promise.resolve();
    };
    modifier2Command.execute = (): Promise<void> => {
      hasRun.push(modifier2Command.name);
      return Promise.resolve();
    };
    globalCommand.execute = (): Promise<void> => {
      hasRun.push(globalCommand.name);
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([
      globalCommand,
      modifier1Command,
      modifier2Command,
    ]);
    const runResult = await run(
      ["--modifier2=foo", "-g", "bar", "--modifier1=bar"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(hasRun[0]).toEqual("modifier1");
    expect(hasRun[1]).toEqual("modifier2");
    expect(hasRun[2]).toEqual("global");
  });

  test("Warning for unused leading args", async () => {
    const streamString = new StreamString();
    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);
    const commandRegistry = new DefaultCommandRegistry([subCommand]);
    const runResult = await run(
      ["blah", "command", "--foo", "bar"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expectStringIncludes(streamString.getString(), "Unused arg: blah");
  });

  test("Warning for unused trailing args", async () => {
    const streamString = new StreamString();
    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);
    const commandRegistry = new DefaultCommandRegistry([subCommand]);
    const runResult = await run(
      ["command", "--foo", "bar", "blah"],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(streamString),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expectStringIncludes(streamString.getString(), "Unused arg: blah");
  });

  test("Sub-Command run with complex options and explicit arrays", async () => {
    let hasRun = false;
    const options = [{
      name: "alpha",
      shortAlias: "a",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
      properties: [{
        name: "beta",
        shortAlias: "b",
        type: ComplexValueTypeName.COMPLEX,
        isArray: true,
        properties: [{
          name: "gamma",
          shortAlias: "g",
          type: ArgumentValueTypeName.STRING,
        }, {
          name: "delta",
          shortAlias: "d",
          type: ArgumentValueTypeName.NUMBER,
          isArray: true,
        }],
      }],
    }, {
      name: "epsilon",
      shortAlias: "e",
      type: ComplexValueTypeName.COMPLEX,
      properties: [{
        name: "gamma",
        shortAlias: "g",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "delta",
        shortAlias: "d",
        type: ArgumentValueTypeName.NUMBER,
      }],
    }];
    const command = getSubCommand("command", options, []);

    command.execute = (): Promise<void> => {
      hasRun = true;

      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([command]);
    const runResult = await run(
      [
        "command",
        "-e.g=bar",
        "-e.d=1",
        "-a.b[1].g=foo2",
        "--alpha.beta[0].gamma=foo1",
        "-a.b[1].d[1]=2",
        "-a.b[0].d=1",
        "-a.b[1].d[0]=3",
      ],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(hasRun).toBeTrue();
  });

  test("Sub-Command run with complex options and positionals", async () => {
    let hasRun = false;
    const options = [{
      name: "alpha",
      shortAlias: "a",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
      properties: [{
        name: "beta",
        shortAlias: "b",
        type: ComplexValueTypeName.COMPLEX,
        isArray: true,
        properties: [{
          name: "gamma",
          shortAlias: "g",
          type: ArgumentValueTypeName.STRING,
        }, {
          name: "delta",
          shortAlias: "d",
          type: ArgumentValueTypeName.NUMBER,
          isArray: true,
        }],
      }],
    }, {
      name: "epsilon",
      shortAlias: "e",
      type: ComplexValueTypeName.COMPLEX,
      properties: [{
        name: "gamma",
        shortAlias: "g",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "delta",
        shortAlias: "d",
        type: ArgumentValueTypeName.NUMBER,
      }],
    }];
    const positionals = [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "bar",
      type: ArgumentValueTypeName.INTEGER,
      isVarargMultiple: true,
      isVarargOptional: true,
    }];

    const command = getSubCommand("command", options, positionals);

    command.execute = (): Promise<void> => {
      hasRun = true;

      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([command]);
    let runResult = await run(
      [
        "command",
        "-e.g=bar",
        "-e.d=1",
        "-a.b[1].g=foo2",
        "--alpha.beta[0].gamma=foo1",
        "-a.b[1].d[1]=2",
        "-a.b[0].d=1",
        "-a.b[1].d[0]=3",
        "foo",
      ],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(hasRun).toBeTrue();

    runResult = await run(
      [
        "command",
        "-e.g=bar",
        "-e.d=1",
        "-a.b[1].g=foo2",
        "--alpha.beta[0].gamma=foo1",
        "-a.b[1].d[1]=2",
        "-a.b[0].d=1",
        "-a.b[1].d[0]=3",
        "foo",
        "1",
        "2",
      ],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(hasRun).toBeTrue();

    runResult = await run(
      [
        "command",
        "foo",
        "-e.g=bar",
        "-e.d=1",
        "-a.b[1].g=foo2",
        "--alpha.beta[0].gamma=foo1",
        "-a.b[1].d[1]=2",
        "-a.b[0].d=1",
        "-a.b[1].d[0]=3",
        "1",
        "2",
      ],
      commandRegistry,
      getServiceProviderRegistry(),
      undefined,
      getContext(new WritableStreamString()),
    );

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(hasRun).toBeTrue();
  });

  test("Group command as default command is invalid", async () => {
    const streamString = new StreamString();
    const groupCommand = getGroupCommand();

    groupCommand.execute = (): Promise<void> => {
      return Promise.resolve();
    };

    await expect(
      run(
        [],
        new DefaultCommandRegistry([]),
        getServiceProviderRegistry(),
        undefined,
        getContext(streamString),
        groupCommand as unknown as GlobalModifierCommand,
      ),
    ).rejects.toThrow();
  });

  test("Global modifier specified fully by config and global run", async () => {
    let modifierHasRun = false;
    let globalHasRun = false;

    const modifierCommand = getGlobalModifierCommandWithArgument(
      "modifier",
      "m",
      1,
      {
        type: ArgumentValueTypeName.STRING,
      },
      true,
    );
    const globalCommand = getGlobalCommandWithShortAlias("global", "g", {
      type: ArgumentValueTypeName.STRING,
    });

    modifierCommand.execute = (_context, argumentValue): Promise<void> => {
      expect(argumentValue).toEqual("foo");
      modifierHasRun = true;
      return Promise.resolve();
    };
    globalCommand.execute = (_context, argumentValue): Promise<void> => {
      expect(argumentValue).toEqual("bar");
      globalHasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([
      modifierCommand,
      globalCommand,
    ]);
    const runResult = await run(
      ["-g", "bar"],
      commandRegistry,
      getServiceProviderRegistry(),
      getConfigurationServiceProvider(
        90,
        new Map<string, ArgumentValues | ArgumentSingleValueType>([
          ["modifier", "foo"],
          ["irrelevant", {
            name: "value",
          }],
        ]),
      ),
      getContext(new WritableStreamString()),
    );
    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(modifierHasRun).toBeTrue();
    expect(globalHasRun).toBeTrue();
  });
});
