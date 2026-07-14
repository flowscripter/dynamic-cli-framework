import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService, SpawnService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID, SPAWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type {
  MarketplacePluginManager,
  SpawnCapable,
} from "@flowscripter/dynamic-plugin-framework";
import { PLUGIN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultPluginService from "./DefaultPluginService.ts";
import { PluginGroupCommand } from "./command/PluginGroupCommand.ts";
import SpawnInterfaceAdapter, {
  type SpawnInterfaceAdapterOptions,
} from "./SpawnInterfaceAdapter.ts";
import getLogger from "../../util/logger.ts";

const logger = getLogger("DefaultPluginServiceProvider");

export default class DefaultPluginServiceProvider implements ServiceProvider {
  readonly serviceId = PLUGIN_SERVICE_ID;
  readonly servicePriority: number;
  readonly #pluginManager: MarketplacePluginManager;
  readonly #spawnInterfaceAdapterOptions: SpawnInterfaceAdapterOptions;
  #pluginService: DefaultPluginService | undefined;

  constructor(
    pluginManager: MarketplacePluginManager,
    servicePriority = 50,
    spawnInterfaceAdapterOptions: SpawnInterfaceAdapterOptions = {},
  ) {
    this.#pluginManager = pluginManager;
    this.servicePriority = servicePriority;
    this.#spawnInterfaceAdapterOptions = spawnInterfaceAdapterOptions;
  }

  async getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    this.#pluginService = new DefaultPluginService(this.#pluginManager);
    return {
      service: this.#pluginService,
      commands: [new PluginGroupCommand()],
    };
  }

  initService(context: Context): Promise<void> {
    if (!context.doesServiceExist(SPAWN_SERVICE_ID)) {
      logger.debug("SpawnService not available, plugin manager will spawn processes directly");
      return Promise.resolve();
    }
    if (!("setSpawn" in this.#pluginManager)) {
      logger.debug("Plugin manager does not support SpawnCapable, skipping spawn injection");
      return Promise.resolve();
    }

    const spawnService = context.getServiceById(SPAWN_SERVICE_ID) as SpawnService;
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const adapter = new SpawnInterfaceAdapter(
      spawnService,
      printerService,
      this.#spawnInterfaceAdapterOptions,
    );
    (this.#pluginManager as unknown as SpawnCapable).setSpawn(adapter);
    return Promise.resolve();
  }
}
