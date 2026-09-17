import process from "node:process";
import path from "node:path";
import type {
  CLIConfig,
  SubCommand,
  Command,
  RunResult,
  ServiceProvider,
  StartupTask,
} from "@flowscripter/dynamic-cli-framework-api";
import type BaseCLIFeatureOptions from "./cli/BaseCLIFeatureOptions.ts";
import DefaultRuntimeCLI from "./cli/DefaultRuntimeCLI.ts";

export async function launchSingleCommandCLI(
  command: SubCommand,
  description?: string,
  name?: string,
  version?: string,
  serviceProviders?: ReadonlyArray<ServiceProvider>,
  options?: BaseCLIFeatureOptions,
  startupTasks?: ReadonlyArray<StartupTask>,
): Promise<RunResult> {
  if (!name) {
    name = path.basename(process.execPath);
  }
  const cliConfig: CLIConfig = {
    description,
    name,
    version: version || "N/A",
  };

  const mergedOptions: BaseCLIFeatureOptions = {
    ...options,
    validateAllCommands:
      (options?.validateAllCommands ?? false) ||
      process.env.DYNAMIC_CLI_FRAMEWORK_VALIDATE_ALL !== undefined,
  };
  const cli = new DefaultRuntimeCLI(cliConfig, mergedOptions);

  cli.addCommand(command);

  serviceProviders?.forEach((serviceProvider) => cli.addServiceProvider(serviceProvider));
  startupTasks?.forEach((startupTask) => cli.addStartupTask(startupTask));

  return await cli.run();
}

export async function launchMultiCommandCLI(
  commands: ReadonlyArray<Command>,
  description?: string,
  name?: string,
  version?: string,
  serviceProviders?: ReadonlyArray<ServiceProvider>,
  options?: BaseCLIFeatureOptions,
  startupTasks?: ReadonlyArray<StartupTask>,
): Promise<RunResult> {
  if (!name) {
    name = path.basename(process.execPath);
  }
  const cliConfig: CLIConfig = {
    description,
    name,
    version: version || "N/A",
  };

  const mergedOptions: BaseCLIFeatureOptions = {
    ...options,
    validateAllCommands:
      (options?.validateAllCommands ?? false) ||
      process.env.DYNAMIC_CLI_FRAMEWORK_VALIDATE_ALL !== undefined,
  };
  const cli = new DefaultRuntimeCLI(cliConfig, mergedOptions);

  commands.forEach((command) => cli.addCommand(command));

  serviceProviders?.forEach((serviceProvider) => cli.addServiceProvider(serviceProvider));
  startupTasks?.forEach((startupTask) => cli.addStartupTask(startupTask));

  return await cli.run();
}
