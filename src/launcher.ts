import process from "node:process";
import path from "node:path";
import type CLIConfig from "./api/CLIConfig.ts";
import type BaseCLIFeatureOptions from "./api/BaseCLIFeatureOptions.ts";
import type SubCommand from "./api/command/SubCommand.ts";
import DefaultRuntimeCLI from "./cli/DefaultRuntimeCLI.ts";
import DynamicPluginRuntimeCLI from "./cli/DynamicPluginRuntimeCLI.ts";
import type Command from "./api/command/Command.ts";
import type RunResult from "./api/RunResult.ts";
import type { ServiceProvider } from "./api/service/ServiceProvider.ts";
import type { MarketplacePluginManager } from "@flowscripter/dynamic-plugin-framework";

export async function launchSingleCommandCLI(
  command: SubCommand,
  description?: string,
  name?: string,
  version?: string,
  serviceProviders?: ReadonlyArray<ServiceProvider>,
  options?: BaseCLIFeatureOptions,
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

  serviceProviders?.forEach((service) => cli.addServiceProvider(service));

  return await cli.run();
}

export async function launchMultiCommandCLI(
  commands: ReadonlyArray<Command>,
  description?: string,
  name?: string,
  version?: string,
  serviceProviders?: ReadonlyArray<ServiceProvider>,
  options?: BaseCLIFeatureOptions,
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

  serviceProviders?.forEach((service) => cli.addServiceProvider(service));

  return await cli.run();
}

export async function launchDynamicPluginMultiCommandCLI(
  pluginManager: MarketplacePluginManager,
  commands: ReadonlyArray<Command>,
  description?: string,
  name?: string,
  version?: string,
  serviceProviders?: ReadonlyArray<ServiceProvider>,
  options?: BaseCLIFeatureOptions,
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
  const cli = new DynamicPluginRuntimeCLI(cliConfig, pluginManager, mergedOptions);

  commands.forEach((command) => cli.addCommand(command));

  serviceProviders?.forEach((service) => cli.addServiceProvider(service));

  return await cli.run();
}
