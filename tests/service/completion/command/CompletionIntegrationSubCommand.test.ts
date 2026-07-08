import { describe, expect, test } from "bun:test";
import { CompletionIntegrationSubCommand } from "../../../../src/service/completion/command/CompletionIntegrationSubCommand.ts";

describe("CompletionIntegrationSubCommand", () => {
  test("has correct name", () => {
    const cmd = new CompletionIntegrationSubCommand();
    expect(cmd.name).toEqual("integration");
  });

  test("has shell positional with allowable values", () => {
    const cmd = new CompletionIntegrationSubCommand();
    expect(cmd.positionals.length).toEqual(1);
    expect(cmd.positionals[0]!.name).toEqual("shell");
    expect(cmd.positionals[0]!.allowableValues).toEqual(["bash", "zsh", "fish", "powershell"]);
  });

  test("has optional config-path option", () => {
    const cmd = new CompletionIntegrationSubCommand();
    expect(cmd.options.length).toEqual(1);
    expect(cmd.options[0]!.name).toEqual("config-path");
    expect(cmd.options[0]!.isOptional).toEqual(true);
  });
});
