import process from "node:process";
import path from "node:path";
import type CLIConfig from "./api/CLIConfig.ts";
import type SubCommand from "./api/command/SubCommand.ts";
import DefaultRuntimeCLI from "./cli/DefaultRuntimeCLI.ts";
import type Command from "./api/command/Command.ts";
import type RunResult from "./api/RunResult.ts";
import type { ServiceProvider } from "./api/service/ServiceProvider.ts";

/**
 * Launch a {@link DefaultRuntimeCLI} with a single specified {@link SubCommand} instance.
 *
 * @param command the {@link SubCommand} to add to the CLI.
 * @param description optional description of the CLI.
 * @param name optional name of the CLI. If not provided, `process.execPath` will be used in an attempt to derive the name.
 * @param version optional version of the CLI.
 * @param envVarsEnabled optionally support checking env variables for default argument values.
 * @param configEnabled optionally enable configuration file support for default argument values.
 * @param keyValueServiceEnabled optionally provide a {@link KeyValueService} implementation: `configEnabled` must be true in this case
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
  serviceProviders?: ReadonlyArray<ServiceProvider>,
): Promise<RunResult> {
  if (!name) {
    name = path.basename(process.execPath);
  }
  const cliConfig: CLIConfig = {
    description,
    name,
    version: version || "N/A",
  };

  if (!configEnabled && keyValueServiceEnabled) {
    throw new Error(
      "configEnabled must be true if keyValueServiceEnabled is true",
    );
  }
  const validateAllCommands = process.env.DYNAMIC_CLI_FRAMEWORK_VALIDATE_ALL !== undefined;
  const cli = new DefaultRuntimeCLI(
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
 * Launch a {@link DefaultRuntimeCLI} with multiple specified {@link Command} instances.
 *
 * @param commands the {@link Command} instances to add to the CLI.
 * @param description optional description of the CLI.
 * @param name optional name of the CLI. If not provided, `process.execPath` will be used in an attempt to derive the name.
 * @param version optional version of the CLI.
 * @param envVarsEnabled optionally support checking env variables for default argument values.
 * @param configEnabled optionally enable configuration file support for default argument values.
 * @param keyValueServiceEnabled optionally provide a {@link KeyValueService} implementation: `configEnabled` must be true in this case
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
  serviceProviders?: ReadonlyArray<ServiceProvider>,
): Promise<RunResult> {
  if (!name) {
    name = path.basename(process.execPath);
  }
  const cliConfig: CLIConfig = {
    description,
    name,
    version: version || "N/A",
  };
  if (!configEnabled && keyValueServiceEnabled) {
    throw new Error(
      "configEnabled must be true if keyValueServiceEnabled is true",
    );
  }
  const validateAllCommands = process.env.DYNAMIC_CLI_FRAMEWORK_VALIDATE_ALL !== undefined;
  const cli = new DefaultRuntimeCLI(
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
