import type { GroupCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { CompletionIntegrationSubCommand } from "./CompletionIntegrationSubCommand.ts";
import type { CompletionCompleteSubCommand } from "./CompletionCompleteSubCommand.ts";

export class CompletionGroupCommand implements GroupCommand {
  readonly name = "completion";
  readonly description = "Manage shell auto-completion";
  readonly enableConfiguration = false;
  readonly memberSubCommands: ReadonlyArray<SubCommand>;

  constructor(
    integrationCommand: CompletionIntegrationSubCommand,
    completeCommand: CompletionCompleteSubCommand,
  ) {
    this.memberSubCommands = [integrationCommand, completeCommand];
  }

  async execute(_context: Context): Promise<void> {}
}
