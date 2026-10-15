import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { GroupCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Group command named `config` whose members manage the configuration handled by
 * {@link ConfigurationServiceProvider}.
 */
export default class ConfigGroupCommand implements GroupCommand {
  readonly name = "config";
  readonly description = "Manage configuration";
  readonly enableConfiguration = false;
  readonly memberSubCommands: ReadonlyArray<SubCommand>;

  public constructor(memberSubCommands: ReadonlyArray<SubCommand>) {
    this.memberSubCommands = memberSubCommands;
  }

  public async execute(_context: Context): Promise<void> {}
}
