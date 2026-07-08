import { describe, expect, test } from "bun:test";
import { CompletionGroupCommand } from "../../../../src/service/completion/command/CompletionGroupCommand.ts";
import { CompletionIntegrationSubCommand } from "../../../../src/service/completion/command/CompletionIntegrationSubCommand.ts";
import { CompletionCompleteSubCommand } from "../../../../src/service/completion/command/CompletionCompleteSubCommand.ts";

describe("CompletionGroupCommand", () => {
  test("has correct name", () => {
    const cmd = new CompletionGroupCommand(
      new CompletionIntegrationSubCommand(),
      new CompletionCompleteSubCommand(),
    );
    expect(cmd.name).toEqual("completion");
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
