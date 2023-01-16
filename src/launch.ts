import { path } from "../deps.ts";
import CLIConfig from "./api/CLIConfig.ts";
import SubCommand from "./api/command/SubCommand.ts";
import { DenoRuntimeCLI } from "./DenoRuntimeCLI.ts";
import Command from "./api/command/Command.ts";
import RunResult from "./api/RunResult.ts";

// TODO: 7. Plugin service and commands: upgrade, no-auto-upgrade
// TODO: FEATURE: Add Prompt service
// TODO: FEATURE: Add Update service: self-update, no-auto-update => after compile/distribution supported: https://github.com/hayd/deno-udd/blob/master/main.ts#L79

function parseVersion(moduleUrl?: string): string {
  if (moduleUrl === undefined) {
    return "";
  }

  const v = moduleUrl.match(/@([^\/]+)[\/$]?/);
  if (v === null) {
    return "";
  }
  return v[1];
}

/**
 * Launch a {@link DenoRuntimeCLI} with the specified {@link SubCommand} instance.
 *
 * @param command the {@link SubCommand} to add to the CLI.
 * @param description optional description of the CLI.
 * @param name optional name of the CLI. If not provided, `Deno.execPath()` will be used to attempt deriving the name.
 * @param version optional version of the CLI. If not provided the optionally provided {@link callingModuleUrl} will be used to attempt parsing the version.
 * @param callingModuleUrl optional URL of the calling module, can be used to attempt to derive the version of the CLI if {@link version} is not provided.
 */
export async function launchSingleCommandCLI(
  command: SubCommand,
  description?: string,
  name?: string,
  version?: string,
  callingModuleUrl?: string,
): Promise<RunResult> {
  const cliConfig: CLIConfig = {
    description,
    name: name || path.basename(Deno.execPath()),
    version: version || parseVersion(callingModuleUrl) || "N/A",
  };
  const cli = new DenoRuntimeCLI(cliConfig);

  cli.addCommand(command);

  return await cli.run();
}

/**
 * Launch a {@link DenoRuntimeCLI} with the specified {@link Command} instances.
 *
 * @param commands the {@link Command} instances to add to the CLI.
 * @param description optional description of the CLI.
 * @param name optional name of the CLI. If not provided, `Deno.execPath()` will be used to attempt deriving the name.
 * @param version optional version of the CLI. If not provided the optionally provided {@link callingModuleUrl} will be used to attempt parsing the version.
 * @param callingModuleUrl optional URL of the calling module, can be used to attempt to derive the version of the CLI if {@link version} is not provided.
 */
export async function launchMultiCommandCLI(
  commands: ReadonlyArray<Command>,
  description?: string,
  name?: string,
  version?: string,
  callingModuleUrl?: string,
): Promise<RunResult> {
  const cliConfig: CLIConfig = {
    description,
    name: name || path.basename(Deno.execPath()),
    version: version || parseVersion(callingModuleUrl),
  };
  const cli = new DenoRuntimeCLI(cliConfig);

  commands.forEach((command) => cli.addCommand(command));

  return await cli.run();
}
