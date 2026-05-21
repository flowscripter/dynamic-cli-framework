import { describe, expect, test } from "bun:test";
import {
  CompletionCompleteSubCommand,
  CompletionGroupCommand,
  CompletionIntegrationSubCommand,
} from "../../src/command/CompletionCommand.ts";

describe("CompletionIntegrationSubCommand", () => {
  test("has correct name", () => {
    const cmd = new CompletionIntegrationSubCommand();
    expect(cmd.name).toEqual("integration");
  });

  test("has shell positional with allowable values", () => {
    const cmd = new CompletionIntegrationSubCommand();
    expect(cmd.positionals.length).toEqual(1);
    expect(cmd.positionals[0]!.name).toEqual("shell");
    expect(cmd.positionals[0]!.allowableValues).toEqual([
      "bash",
      "zsh",
      "fish",
      "powershell",
    ]);
  });

  test("has optional config-path option", () => {
    const cmd = new CompletionIntegrationSubCommand();
    expect(cmd.options.length).toEqual(1);
    expect(cmd.options[0]!.name).toEqual("config-path");
    expect(cmd.options[0]!.isOptional).toEqual(true);
  });
});

describe("CompletionCompleteSubCommand", () => {
  test("has correct name", () => {
    const cmd = new CompletionCompleteSubCommand();
    expect(cmd.name).toEqual("complete");
  });

  test("has shell positional and vararg args positional", () => {
    const cmd = new CompletionCompleteSubCommand();
    expect(cmd.positionals.length).toEqual(2);
    expect(cmd.positionals[0]!.name).toEqual("shell");
    expect(cmd.positionals[1]!.name).toEqual("args");
    expect(cmd.positionals[1]!.isVarargMultiple).toEqual(true);
    expect(cmd.positionals[1]!.isVarargOptional).toEqual(true);
  });
});

describe("CompletionGroupCommand", () => {
  test("has correct name", () => {
    const cmd = new CompletionGroupCommand(
      new CompletionIntegrationSubCommand(),
      new CompletionCompleteSubCommand(),
    );
    expect(cmd.name).toEqual("completions");
  });

  test("has two member sub-commands", () => {
    const cmd = new CompletionGroupCommand(
      new CompletionIntegrationSubCommand(),
      new CompletionCompleteSubCommand(),
    );
    expect(cmd.memberSubCommands.length).toEqual(2);
    expect(cmd.memberSubCommands[0]!.name).toEqual("integration");
    expect(cmd.memberSubCommands[1]!.name).toEqual("complete");
  });
});
