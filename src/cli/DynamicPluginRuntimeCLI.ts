import type { MarketplacePluginManager } from "@flowscripter/dynamic-plugin-framework";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import type { BaseCLIFeatureOptions } from "@flowscripter/dynamic-cli-framework-api";
import type { RunResult } from "@flowscripter/dynamic-cli-framework-api";
import { RunState } from "@flowscripter/dynamic-cli-framework-api";
import DefaultRuntimeCLI from "./DefaultRuntimeCLI.ts";
import DefaultPluginServiceProvider from "../service/plugin/DefaultPluginServiceProvider.ts";
import { DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT } from "@flowscripter/dynamic-cli-framework-api";
import { DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT } from "@flowscripter/dynamic-cli-framework-api";
import type { CommandFactory } from "@flowscripter/dynamic-cli-framework-api";
import type { ServiceProviderFactory } from "@flowscripter/dynamic-cli-framework-api";
import process from "node:process";

/**
 * Extension of {@link DefaultRuntimeCLI} that discovers and loads installed plugins before running.
 *
 * On each invocation of {@link run}, all locally installed plugins are discovered via the
 * {@link MarketplacePluginManager}. Commands provided by {@link CommandFactory} extensions and
 * service providers provided by {@link ServiceProviderFactory} extensions are registered before
 * the runner starts, so they participate in the full initialization lifecycle.
 */
export default class DynamicPluginRuntimeCLI extends DefaultRuntimeCLI {
  readonly #pluginManager: MarketplacePluginManager;

  constructor(
    cliConfig: CLIConfig,
    pluginManager: MarketplacePluginManager,
    options?: BaseCLIFeatureOptions,
  ) {
    super(cliConfig, options);
    this.#pluginManager = pluginManager;
    this.addServiceProvider(new DefaultPluginServiceProvider(pluginManager));
  }

  override async run(): Promise<RunResult> {
    try {
      await this.loadPlugins();
    } catch (err) {
      console.error(err);
      process.exit(RunState.RUNTIME_ERROR);
    }
    return super.run();
  }

  async loadPlugins(): Promise<void> {
    await this.#pluginManager.registerExtensions(
      DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT,
    );
    await this.#pluginManager.registerExtensions(
      DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT,
    );

    const commandFactoryExtensions = await this.#pluginManager.getRegisteredExtensions(
      DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT,
    );
    for (const ext of commandFactoryExtensions) {
      const factory = (await this.#pluginManager.instantiate(
        ext.extensionHandle,
      )) as CommandFactory;
      for (const command of factory.getCommands()) {
        this.addCommand(command);
      }
    }

    const spFactoryExtensions = await this.#pluginManager.getRegisteredExtensions(
      DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT,
    );
    for (const ext of spFactoryExtensions) {
      const factory = (await this.#pluginManager.instantiate(
        ext.extensionHandle,
      )) as ServiceProviderFactory;
      for (const sp of factory.getServiceProviders()) {
        this.addServiceProvider(sp);
      }
    }
  }
}
