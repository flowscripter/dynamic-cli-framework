import { describe, expect, test } from "bun:test";
import { CompletionCompleteSubCommand } from "../../../../src/service/completion/command/CompletionCompleteSubCommand.ts";

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
