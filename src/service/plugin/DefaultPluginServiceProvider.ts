import type { ServiceInfo, ServiceProvider } from "../../api/service/ServiceProvider.ts";
import type Context from "../../api/Context.ts";
import type CLIConfig from "../../api/CLIConfig.ts";
import type { MarketplacePluginManager } from "@flowscripter/dynamic-plugin-framework";
import { PLUGIN_SERVICE_ID } from "../../api/service/core/PluginService.ts";
import DefaultPluginService from "./DefaultPluginService.ts";
import { PluginGroupCommand } from "./command/PluginGroupCommand.ts";

export default class DefaultPluginServiceProvider implements ServiceProvider {
  readonly serviceId = PLUGIN_SERVICE_ID;
  readonly servicePriority: number;
  readonly #pluginManager: MarketplacePluginManager;
  #pluginService: DefaultPluginService | undefined;

  constructor(pluginManager: MarketplacePluginManager, servicePriority = 50) {
    this.#pluginManager = pluginManager;
    this.servicePriority = servicePriority;
  }

  async getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    this.#pluginService = new DefaultPluginService(this.#pluginManager);
    return {
      service: this.#pluginService,
      commands: [new PluginGroupCommand()],
    };
  }

  async initService(_context: Context): Promise<void> {}
}
