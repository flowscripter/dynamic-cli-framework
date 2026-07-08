import type GroupCommand from "../../../api/command/GroupCommand.ts";
import type SubCommand from "../../../api/command/SubCommand.ts";
import type Context from "../../../api/Context.ts";
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
