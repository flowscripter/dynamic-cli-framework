import { describe, expect, test } from "bun:test";
import DefaultCompletionService from "../../../src/service/completion/DefaultCompletionService.ts";
import DefaultCommandRegistry from "../../../src/runtime/registry/DefaultCommandRegistry.ts";
import { ShellType } from "../../../src/api/service/core/CompletionService.ts";
import type SubCommand from "../../../src/api/command/SubCommand.ts";
import type GroupCommand from "../../../src/api/command/GroupCommand.ts";
import type GlobalCommand from "../../../src/api/command/GlobalCommand.ts";
import type GlobalModifierCommand from "../../../src/api/command/GlobalModifierCommand.ts";
import { ArgumentValueTypeName } from "../../../src/api/argument/ArgumentValueTypes.ts";
import type Context from "../../../src/api/Context.ts";

function makeSubCommand(
  name: string,
  description = "",
  options: SubCommand["options"] = [],
  positionals: SubCommand["positionals"] = [],
): SubCommand {
  return {
    name,
    description,
    enableConfiguration: false,
    options,
    positionals,
    execute: () => Promise.resolve(),
  };
}

function makeGroupCommand(
  name: string,
  description: string,
  members: SubCommand[],
): GroupCommand {
  return {
    name,
    description,
    enableConfiguration: false,
    memberSubCommands: members,
    execute: (_context: Context) => Promise.resolve(),
  };
}

function makeGlobalCommand(
  name: string,
  description: string,
): GlobalCommand {
  return {
    name,
    description,
    enableConfiguration: false,
    argument: { type: ArgumentValueTypeName.BOOLEAN },
    execute: () => Promise.resolve(),
  };
}

function makeGlobalModifierCommand(
  name: string,
  description: string,
): GlobalModifierCommand {
  return {
    name,
    description,
    enableConfiguration: false,
    argument: { type: ArgumentValueTypeName.BOOLEAN },
    executePriority: 0,
    execute: () => Promise.resolve(),
  };
}

describe("DefaultCompletionService", () => {
  function createService(
    commands: Array<
      SubCommand | GroupCommand | GlobalCommand | GlobalModifierCommand
    >,
  ): DefaultCompletionService {
    const service = new DefaultCompletionService();
    const registry = new DefaultCommandRegistry(commands);
    service.setCommandRegistry(registry);
    return service;
  }

  test("returns empty completions if no registry set", async () => {
    const service = new DefaultCompletionService();
    const result = await service.generateCompletions(
      ShellType.BASH,
      "mycli ",
      6,
    );
    expect(result).toEqual([]);
  });

  test("completes command names from prefix", async () => {
    const service = createService([
      makeSubCommand("help", "Display help"),
      makeSubCommand("history", "Show history"),
      makeSubCommand("run", "Run something"),
    ]);

    const result = await service.generateCompletions(
      ShellType.BASH,
      "mycli h",
      7,
    );
    expect(result.length).toEqual(2);
    expect(result.map((r) => r.value)).toContain("help");
    expect(result.map((r) => r.value)).toContain("history");
  });

  test("completes all commands when no prefix", async () => {
    const service = createService([
      makeSubCommand("help", "Display help"),
      makeSubCommand("run", "Run something"),
    ]);

    const result = await service.generateCompletions(
      ShellType.BASH,
      "mycli ",
      6,
    );
    expect(result.map((r) => r.value)).toContain("help");
    expect(result.map((r) => r.value)).toContain("run");
  });

  test("completes group:member joined names", async () => {
    const members = [
      makeSubCommand("integration", "Install completion"),
      makeSubCommand("complete", "Generate completions"),
    ];
    const group = makeGroupCommand(
      "completions",
      "Completion management",
      members,
    );
    const service = createService([group]);

    const result = await service.generateCompletions(
      ShellType.BASH,
      "mycli comp",
      10,
    );
    const values = result.map((r) => r.value);
    expect(values).toContain("completions");
    expect(values).toContain("completions:integration");
    expect(values).toContain("completions:complete");
  });

  test("completes member sub-commands after group:", async () => {
    const members = [
      makeSubCommand("integration", "Install completion"),
      makeSubCommand("complete", "Generate completions"),
    ];
    const group = makeGroupCommand(
      "completions",
      "Completion management",
      members,
    );
    const service = createService([group]);

    const result = await service.generateCompletions(
      ShellType.BASH,
      "mycli completions:i",
      19,
    );
    const values = result.map((r) => r.value);
    expect(values).toContain("completions:integration");
    expect(values).not.toContain("completions:complete");
  });

  test("completes sub-command options", async () => {
    const cmd = makeSubCommand("deploy", "Deploy app", [
      {
        name: "target",
        type: ArgumentValueTypeName.STRING,
        description: "Deploy target",
        isOptional: true,
      },
      {
        name: "force",
        type: ArgumentValueTypeName.BOOLEAN,
        description: "Force deploy",
        isOptional: true,
        shortAlias: "f",
      },
    ]);
    const service = createService([cmd]);

    const result = await service.generateCompletions(
      ShellType.BASH,
      "mycli deploy --t",
      16,
    );
    const values = result.map((r) => r.value);
    expect(values).toContain("--target");
  });

  test("completes option allowable values", async () => {
    const cmd = makeSubCommand("deploy", "Deploy app", [
      {
        name: "env",
        type: ArgumentValueTypeName.STRING,
        description: "Environment",
        isOptional: true,
        allowableValues: ["staging", "production", "development"],
      },
    ]);
    const service = createService([cmd]);

    const result = await service.generateCompletions(
      ShellType.BASH,
      "mycli deploy --env st",
      21,
    );
    const values = result.map((r) => r.value);
    expect(values).toContain("staging");
    expect(values).not.toContain("production");
  });

  test("completes global modifier commands with -- prefix", async () => {
    const modifier = makeGlobalModifierCommand(
      "verbose",
      "Enable verbose output",
    );
    const cmd = makeSubCommand("run", "Run something");
    const service = createService([modifier, cmd]);

    const result = await service.generateCompletions(
      ShellType.BASH,
      "mycli --v",
      9,
    );
    const values = result.map((r) => r.value);
    expect(values).toContain("--verbose");
  });

  test("completes global commands with -- prefix", async () => {
    const global = makeGlobalCommand("version", "Show version");
    const cmd = makeSubCommand("run", "Run something");
    const service = createService([global, cmd]);

    const result = await service.generateCompletions(
      ShellType.BASH,
      "mycli --ver",
      11,
    );
    const values = result.map((r) => r.value);
    expect(values).toContain("--version");
  });

  test("formatCompletions delegates to shell handler", () => {
    const service = new DefaultCompletionService();
    const result = service.formatCompletions(ShellType.FISH, [
      { value: "help", description: "Display help" },
    ]);
    expect(result).toEqual("help\tDisplay help");
  });

  test("getBootstrapScript delegates to shell handler", () => {
    const service = new DefaultCompletionService();
    const result = service.getBootstrapScript(ShellType.BASH, "mycli");
    expect(result).toContain("_mycli_completions");
  });

  test("getDefaultConfigPath delegates to shell handler", () => {
    const service = new DefaultCompletionService();
    const result = service.getDefaultConfigPath(ShellType.ZSH);
    expect(result).toEndWith("/.zshrc");
  });

  test("parseCompletionContext delegates to shell handler", () => {
    const service = new DefaultCompletionService();
    const result = service.parseCompletionContext(ShellType.BASH, [
      "mycli help",
      "10",
    ]);
    expect(result.line).toEqual("mycli help");
    expect(result.cursorPosition).toEqual(10);
  });
});
