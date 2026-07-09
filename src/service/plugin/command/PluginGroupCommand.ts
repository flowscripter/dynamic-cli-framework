import type { GroupCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import { PluginListSubCommand } from "./PluginListSubCommand.ts";
import { PluginSearchSubCommand } from "./PluginSearchSubCommand.ts";
import { PluginAddSubCommand } from "./PluginAddSubCommand.ts";
import { PluginRemoveSubCommand } from "./PluginRemoveSubCommand.ts";
import { PluginUpgradeSubCommand } from "./PluginUpgradeSubCommand.ts";

export class PluginGroupCommand implements GroupCommand {
  readonly name = "plugin";
  readonly description = "Manage CLI plugins";
  readonly enableConfiguration = false;
  readonly memberSubCommands: ReadonlyArray<SubCommand>;

  constructor() {
    this.memberSubCommands = [
      new PluginListSubCommand(),
      new PluginSearchSubCommand(),
      new PluginAddSubCommand(),
      new PluginRemoveSubCommand(),
      new PluginUpgradeSubCommand(),
    ];
  }

  async execute(_context: Context): Promise<void> {}
}
