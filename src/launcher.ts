import * as path from "@std/path";
import type CLIConfig from "./api/CLIConfig.ts";
import type SubCommand from "./api/command/SubCommand.ts";
import DenoRuntimeCLI from "./cli/DenoRuntimeCLI.ts";
import type Command from "./api/command/Command.ts";
import type RunResult from "./api/RunResult.ts";
import type { ServiceProvider } from "./api/service/ServiceProvider.ts";
import { getEnvVarIfPermitted } from "./util/envVarHelper.ts";

function parseVersion(moduleUrl?: string): string | undefined {
  if (moduleUrl === undefined) {
    return undefined;
  }

  const v = moduleUrl.match(/@([^\/]+)[\/$]?/);
  if (v === null) {
    return undefined;
  }
  return v[1];
}

async function getName(): Promise<string> {
  const permissionDescriptor = { name: "read" } as const;
  const status = await Deno.permissions.request(permissionDescriptor);

  if (status.state !== "granted") {
    return "N/A";
  }
  return path.basename(Deno.execPath());
}

export async function checkPermissions(
  envVarsEnabled: boolean,
  configEnabled: boolean,
  keyValueServiceEnabled: boolean,
): Promise<void> {
  if (envVarsEnabled) {
    const readPermissionDescriptor = { name: "env" } as const;
    const readStatus = await Deno.permissions.request(readPermissionDescriptor);
    if (readStatus.state !== "granted") {
      throw new Error(
        "--allow-env must be specified if envVarsEnabled is true",
      );
    }
  }
  if (configEnabled) {
    const readPermissionDescriptor = { name: "read" } as const;
    const writePermissionDescriptor = { name: "write" } as const;
    const readStatus = await Deno.permissions.request(readPermissionDescriptor);
    const writeStatus = await Deno.permissions.request(
      writePermissionDescriptor,
    );
    if ((readStatus.state !== "granted") || (writeStatus.state !== "granted")) {
      throw new Error(
        "--allow-read and --allow-write must be specified if configEnabled is true",
      );
    }
    if (!configEnabled && keyValueServiceEnabled) {
      throw new Error(
        "configEnabled must be true if keyValueServiceEnabled is true",
      );
    }
  }
}

/**
 * Launch a {@link DenoRuntimeCLI} with a single specified {@link SubCommand} instance.
 *
 * @param command the {@link SubCommand} to add to the CLI.
 * @param description optional description of the CLI.
 * @param name optional name of the CLI. If not provided, `Deno.execPath()` will be used in an attempt to derive the name if `allow-read` permission is granted. If not possible the default is `N/A`.
 * @param version optional version of the CLI. If not provided the optionally provided {@link callingModuleUrl} will be used in an attempt to derive the version. If not possible the default is `N/A`.
 * @param envVarsEnabled optionally support checking env variables for default argument values.
 * @param configEnabled optionally enable configuration file support for default argument values.
 * @param keyValueServiceEnabled optionally provide a {@link KeyValueService} implementation: `configEnabled` must be true in this case
 * @param callingModuleUrl optional URL of the calling module, can be used in an attempt to derive the version of the CLI if {@link version} is not provided. If not possible the default is `N/A`.
 * @param serviceProviders optional array of {@link ServiceProvider} instances to add to the CLI.
 */
export async function launchSingleCommandCLI(
  command: SubCommand,
  description?: string,
  name?: string,
  version?: string,
  envVarsEnabled = false,
  configEnabled = false,
  keyValueServiceEnabled = false,
  callingModuleUrl?: string,
  serviceProviders?: ReadonlyArray<ServiceProvider>,
): Promise<RunResult> {
  if (!name) {
    name = await getName();
  }
  const cliConfig: CLIConfig = {
    description,
    name,
    version: version || parseVersion(callingModuleUrl) || "N/A",
  };

  await checkPermissions(envVarsEnabled, configEnabled, keyValueServiceEnabled);
  const validateAllCommands =
    (await getEnvVarIfPermitted("CLI_VALIDATE_ALL")) !== undefined;
  const cli = new DenoRuntimeCLI(
    cliConfig,
    envVarsEnabled,
    configEnabled,
    keyValueServiceEnabled,
    validateAllCommands,
  );

  cli.addCommand(command);

  serviceProviders?.forEach((service) => cli.addServiceProvider(service));

  return await cli.run();
}

/**
 * Launch a {@link DenoRuntimeCLI} with multiple specified {@link Command} instances.
 *
 * @param commands the {@link Command} instances to add to the CLI.
 * @param description optional description of the CLI.
 * @param name optional name of the CLI. If not provided, `Deno.execPath()` will be used in an attempt to derive the name if `allow-read` permission is granted. If not possible the default is `N/A`.
 * @param version optional version of the CLI. If not provided the optionally provided {@link callingModuleUrl} will be used in an attempt to derive the version. If not possible the default is `N/A`.
 * @param envVarsEnabled optionally support checking env variables for default argument values.
 * @param configEnabled optionally enable configuration file support for default argument values.
 * @param keyValueServiceEnabled optionally provide a {@link KeyValueService} implementation: `configEnabled` must be true in this case
 * @param callingModuleUrl optional URL of the calling module, can be used in an attempt to derive the version of the CLI if {@link version} is not provided. If not possible the default is `N/A`.
 * @param serviceProviders optional array of {@link ServiceProvider} instances to add to the CLI.
 */
export async function launchMultiCommandCLI(
  commands: ReadonlyArray<Command>,
  description?: string,
  name?: string,
  version?: string,
  envVarsEnabled = false,
  configEnabled = false,
  keyValueServiceEnabled = false,
  callingModuleUrl?: string,
  serviceProviders?: ReadonlyArray<ServiceProvider>,
): Promise<RunResult> {
  if (!name) {
    name = await getName();
  }
  const cliConfig: CLIConfig = {
    description,
    name,
    version: version || parseVersion(callingModuleUrl) || "N/A",
  };
  await checkPermissions(envVarsEnabled, configEnabled, keyValueServiceEnabled);
  const validateAllCommands =
    (await getEnvVarIfPermitted("CLI_VALIDATE_ALL")) !== undefined;
  const cli = new DenoRuntimeCLI(
    cliConfig,
    envVarsEnabled,
    configEnabled,
    keyValueServiceEnabled,
    validateAllCommands,
  );

  commands.forEach((command) => cli.addCommand(command));

  serviceProviders?.forEach((service) => cli.addServiceProvider(service));

  return await cli.run();
}
