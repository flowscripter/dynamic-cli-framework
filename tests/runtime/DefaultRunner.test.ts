import {
  ArgumentValueTypeName,
  ComplexOption,
  ComplexValueTypeName,
  GlobalCommand,
  GlobalCommandArgument,
  GlobalModifierCommand,
  GroupCommand,
  Option,
  Positional,
  RunResult,
  SubCommand,
} from "../../mod.ts";
import { assertEquals, Buffer, describe, it } from "../test_deps.ts";
import DefaultRunner from "../../src/runtime/DefaultRunner.ts";
import DefaultParser from "../../src/runtime/DefaultParser.ts";
import DefaultCommandRegistry from "../../src/registry/DefaultCommandRegistry.ts";
import DefaultPrinter from "../../src/service/core/DefaultPrinter.ts";
import DefaultCLIConfig from "../../src/DefaultCLIConfig.ts";

// TODO: test output
// TODO: test logging and printer output never include password values

function getSubCommand(
  name: string,
  options: Array<Option | ComplexOption>,
  positionals: Array<Positional>,
): SubCommand {
  return {
    name,
    options,
    positionals,
    execute: async (): Promise<void> => {},
  };
}

function getGlobalCommand(
  name: string,
  shortAlias: string,
  argument?: GlobalCommandArgument,
): GlobalCommand {
  return {
    name,
    shortAlias,
    argument,
    execute: async (): Promise<void> => {},
  };
}

function getGlobalModifierCommand(
  name: string,
  shortAlias: string,
  executePriority: number,
  argument?: GlobalCommandArgument,
): GlobalModifierCommand {
  return {
    name,
    shortAlias,
    executePriority,
    argument,
    execute: async (): Promise<void> => {},
  };
}

function getGroupCommand(
  name: string,
  memberSubCommands: Array<SubCommand>,
): GroupCommand {
  return {
    name,
    memberSubCommands,
    execute: async (): Promise<void> => {},
  };
}

describe("DefaultRunner", () => {
  it("Sub-Command run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    let hasRun = false;

    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const command = getSubCommand("command", [option], []);

    command.execute = (): Promise<void> => {
      hasRun = true;

      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([command]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["command", "--foo", "bar"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(hasRun, true);
  });

  it("Global Modifier run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    let modifierHasRun = false;
    let subHasRun = false;

    const globalModifierCommand = getGlobalModifierCommand(
      "modifierCommand",
      "c",
      1,
      {
        name: "value",
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
    const runner = new DefaultRunner(new DefaultParser(), printer);
    let runResult = await runner.run(
      ["--modifierCommand=bar", "subCommand"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(modifierHasRun, true);
    assertEquals(subHasRun, true);

    modifierHasRun = false;
    subHasRun = false;

    runResult = await runner.run(
      ["-c", "bar", "subCommand"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(modifierHasRun, true);
    assertEquals(subHasRun, true);
  });

  it("Global Command run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    let hasRun = false;

    const command = getGlobalCommand("command", "c", {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    });

    command.execute = (): Promise<void> => {
      hasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([command]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    let runResult = await runner.run(
      ["--command=bar"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(hasRun, true);

    hasRun = false;

    runResult = await runner.run(
      ["-c", "bar"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(hasRun, true);
  });

  it("Group Command run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    let subHasRun = false;
    let groupHasRun = false;

    const subCommand = getSubCommand("command", [], []);
    const grouoCommand = getGroupCommand("group", [subCommand]);

    subCommand.execute = (): Promise<void> => {
      subHasRun = true;
      return Promise.resolve();
    };
    grouoCommand.execute = (): Promise<void> => {
      groupHasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([grouoCommand]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    let runResult = await runner.run(
      ["group", "command"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(groupHasRun, true);
    assertEquals(subHasRun, true);

    runResult = await runner.run(
      ["group:command"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(groupHasRun, true);
    assertEquals(subHasRun, true);
  });

  it("Global modifier and non-global run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    let modifierHasRun = false;
    let subHasRun = false;

    const modifierCommand = getGlobalModifierCommand("modifier", "m", 1, {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    });
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
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--modifier=bar", "command", "--foo", "bar"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(modifierHasRun, true);
    assertEquals(subHasRun, true);
  });

  it("Global modifier and global run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    let modifierHasRun = false;
    let globalHasRun = false;

    const modifierCommand = getGlobalModifierCommand("modifier", "m", 1, {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    });
    const globalCommand = getGlobalCommand("global", "g", {
      name: "value",
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
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--modifier=bar", "-g", "bar"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(modifierHasRun, true);
    assertEquals(globalHasRun, true);
  });

  it("Two global modifier and global run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    let modifier1HasRun = false;
    let modifier2HasRun = false;
    let globalHasRun = false;

    const modifierCommand1 = getGlobalModifierCommand("modifier1", "m", 1, {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    });
    const modifierCommand2 = getGlobalModifierCommand("modifier2", "n", 2, {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    });
    const globalCommand = getGlobalCommand("global", "g", {
      name: "value",
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
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--modifier1=bar", "-g", "bar", "--modifier2=bar"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(modifier1HasRun, true);
    assertEquals(modifier2HasRun, true);
    assertEquals(globalHasRun, true);
  });

  it("Global modifier and default run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    let modifierHasRun = false;
    let defaultHasRun = false;

    const modifierCommand = getGlobalModifierCommand("modifier", "m", 1, {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    });
    const globalCommand = getGlobalCommand("global", "g");

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
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--modifier=bar"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
      globalCommand,
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(modifierHasRun, true);
    assertEquals(defaultHasRun, true);
  });

  it("Global modifier parse error", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    let modifierHasRun = false;
    let defaultHasRun = false;

    const modifierCommand = getGlobalModifierCommand("modifier", "m", 1, {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    });
    const globalCommand = getGlobalCommand("global", "g");

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
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--modifier"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
      globalCommand,
    );

    assertEquals(runResult, RunResult.PARSE_ERROR);
    assertEquals(modifierHasRun, false);
    assertEquals(defaultHasRun, false);
  });

  it("Default run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
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

    const commandRegistry = new DefaultCommandRegistry([]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--foo=bar"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
      subCommand,
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(subHasRun, true);
  });

  it("Error thrown in non-global run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);

    subCommand.execute = (): Promise<void> => {
      throw new Error();
    };

    const commandRegistry = new DefaultCommandRegistry([subCommand]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["command", "--foo", "bar"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.COMMAND_ERROR);
  });

  it("Error thrown in global run scenario", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer);
    printer.colorEnabled = false;
    const globalCommand = getGlobalCommand("global", "g", {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    });

    globalCommand.execute = (): Promise<void> => {
      throw new Error("d34db33f");
    };

    const commandRegistry = new DefaultCommandRegistry([globalCommand]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--global=bar"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.COMMAND_ERROR);
    console.error(buffer);
    // expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('Error running'));
    // expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('d34db33f'));
  });

  it("Error thrown in global modifier run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    let globalHasRun = false;

    const globalModifierCommand = getGlobalModifierCommand("modifier", "m", 1);
    const globalCommand = getGlobalCommand("global", "g");

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
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--global", "--modifier"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.COMMAND_ERROR);
    // expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('Error running'));
    // expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('d34db33f'));
    assertEquals(globalHasRun, false);
  });

  it("Parse error warning in non-global run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    printer.colorEnabled = false;
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
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["command", "-f"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.PARSE_ERROR);
    assertEquals(hasRun, false);
  });

  it("No command specified scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    printer.colorEnabled = false;
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
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      [],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.PARSE_ERROR);
    assertEquals(hasRun, false);
  });

  it("Unknown arg warning in non-global run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    printer.colorEnabled = false;
    let hasRun = false;

    const subCommand = getSubCommand("command", [], []);

    subCommand.execute = (): Promise<void> => {
      hasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([subCommand]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["command", "-bad"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    // expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('Unused arg: -bad'));
    assertEquals(hasRun, true);
  });

  it("Unknown arg warning in global run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    printer.colorEnabled = false;
    let hasRun = false;

    const globalCommand = getGlobalCommand("global", "g");

    globalCommand.execute = (): Promise<void> => {
      hasRun = true;
      return Promise.resolve();
    };

    const commandRegistry = new DefaultCommandRegistry([]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--bad"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
      globalCommand,
    );

    assertEquals(runResult, RunResult.SUCCESS);
    // expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('Unused arg: --bad'));
    assertEquals(hasRun, true);
  });

  it("Error thrown default run scenario", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    const globalCommand = getGlobalCommand("global", "g");

    globalCommand.execute = (): Promise<void> => {
      throw new Error("d34db33f");
    };

    const commandRegistry = new DefaultCommandRegistry([]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      [],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
      globalCommand,
    );

    assertEquals(runResult, RunResult.COMMAND_ERROR);
    // expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('Error running'));
    // expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('d34db33f'));
  });

  it("Run default command based on all args", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    const command = getSubCommand("command", [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "goo",
      type: ArgumentValueTypeName.STRING,
    }], []);
    const commandRegistry = new DefaultCommandRegistry([]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--foo=f", "--goo=g"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
      command,
    );

    assertEquals(runResult, RunResult.SUCCESS);
    // expect(mockStderr).not.toHaveBeenCalledWith(expect.stringContaining('Unused'));
  });

  it("Run default command based on config only and treating all args as unused", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    const command = getSubCommand("command", [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "goo",
      type: ArgumentValueTypeName.STRING,
    }], []);
    const commandRegistry = new DefaultCommandRegistry([]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--bip=b", "--bop=b"],
      commandRegistry,
      new DefaultCLIConfig(
        "foo",
        "bar",
        "1",
        new Map([
          ["command", {
            foo: "f",
            goo: "g",
          }],
        ]),
      ),
      {},
      command,
    );

    assertEquals(runResult, RunResult.SUCCESS);
    // expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('Unused'));
  });

  it("Run default command based on some args and treating some args as unused", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    const command = getSubCommand("command", [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "goo",
      type: ArgumentValueTypeName.STRING,
    }], []);

    const commandRegistry = new DefaultCommandRegistry([]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--bip=b", "--goo=g"],
      commandRegistry,
      new DefaultCLIConfig(
        "foo",
        "bar",
        "1",
        new Map([
          ["command", {
            foo: "f",
          }],
        ]),
      ),
      {},
      command,
    );

    assertEquals(runResult, RunResult.SUCCESS);
    // expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('Unused'));
  });

  it("Fail to parse default command with some unused args", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    const command = getSubCommand("command", [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "goo",
      type: ArgumentValueTypeName.STRING,
    }], []);

    const commandRegistry = new DefaultCommandRegistry([]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--bip=b", "--goo=g"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
      command,
    );

    assertEquals(runResult, RunResult.PARSE_ERROR);
  });

  it("Illegal second command treated as unknown arg", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    printer.colorEnabled = false;
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
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["command1", "--foo", "bar", "command2"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    // expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('Unused arg: command2'));
    assertEquals(hasRun, true);
  });

  it("Ensure global modifier and global run priority order", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    const hasRun: string[] = [];

    const modifier1Command = getGlobalModifierCommand("modifier1", "1", 2, {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    });
    const modifier2Command = getGlobalModifierCommand("modifier2", "2", 1, {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    });
    const globalCommand = getGlobalCommand("global", "g", {
      name: "value",
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
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["--modifier2=foo", "-g", "bar", "--modifier1=bar"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(hasRun[0], "modifier1");
    assertEquals(hasRun[1], "modifier2");
    assertEquals(hasRun[2], "global");
  });

  it("Warning for unused leading args", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    printer.colorEnabled = false;
    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);
    const commandRegistry = new DefaultCommandRegistry([subCommand]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["blah", "command", "--foo", "bar"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    // expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('Unused arg: blah'));
  });

  it("Warning for unused trailing args", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
    printer.colorEnabled = false;
    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);
    const commandRegistry = new DefaultCommandRegistry([subCommand]);
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
      ["command", "--foo", "bar", "blah"],
      commandRegistry,
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    // expect(mockStderr).toHaveBeenCalledWith(
    //   expect.stringContaining("Unused arg: blah"),
    // );
  });

  it("Sub-Command run scenario with complex options and explicit arrays", async () => {
    const printer = new DefaultPrinter(Deno.stderr);
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
    const runner = new DefaultRunner(new DefaultParser(), printer);
    const runResult = await runner.run(
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
      new DefaultCLIConfig("foo", "bar", "1"),
      {},
    );

    assertEquals(runResult, RunResult.SUCCESS);
    assertEquals(hasRun, true);
  });
});
