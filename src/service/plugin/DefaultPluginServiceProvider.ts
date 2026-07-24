import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService, SpawnService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID, SPAWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { FetchService } from "@flowscripter/dynamic-cli-framework-api";
import { FETCH_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type {
  FetchCapable,
  MarketplacePluginManager,
  SpawnCapable,
} from "@flowscripter/dynamic-plugin-framework";
import { PLUGIN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultPluginService from "./DefaultPluginService.ts";
import { PluginGroupCommand } from "./command/PluginGroupCommand.ts";
import SpawnInterfaceAdapter, {
  type SpawnInterfaceAdapterOptions,
} from "./SpawnInterfaceAdapter.ts";
import FetchInterfaceAdapter, {
  type FetchInterfaceAdapterOptions,
} from "./FetchInterfaceAdapter.ts";
import getLogger from "../../util/logger.ts";

const logger = getLogger("DefaultPluginServiceProvider");

export default class DefaultPluginServiceProvider implements ServiceProvider {
  readonly serviceId = PLUGIN_SERVICE_ID;
  readonly servicePriority: number;
  readonly #pluginManager: MarketplacePluginManager;
  readonly #spawnInterfaceAdapterOptions: SpawnInterfaceAdapterOptions;
  readonly #fetchInterfaceAdapterOptions: FetchInterfaceAdapterOptions;
  #pluginService: DefaultPluginService | undefined;

  constructor(
    pluginManager: MarketplacePluginManager,
    servicePriority = 50,
    spawnInterfaceAdapterOptions: SpawnInterfaceAdapterOptions = {},
    fetchInterfaceAdapterOptions: FetchInterfaceAdapterOptions = {},
  ) {
    this.#pluginManager = pluginManager;
    this.servicePriority = servicePriority;
    this.#spawnInterfaceAdapterOptions = spawnInterfaceAdapterOptions;
    this.#fetchInterfaceAdapterOptions = fetchInterfaceAdapterOptions;
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
    } else if (!("setSpawn" in this.#pluginManager)) {
      logger.debug("Plugin manager does not support SpawnCapable, skipping spawn injection");
    } else {
      const spawnService = context.getServiceById(SPAWN_SERVICE_ID) as SpawnService;
      const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
      const adapter = new SpawnInterfaceAdapter(
        spawnService,
        printerService,
        this.#spawnInterfaceAdapterOptions,
      );
      (this.#pluginManager as unknown as SpawnCapable).setSpawn(adapter);
    }

    if (!context.doesServiceExist(FETCH_SERVICE_ID)) {
      logger.debug("FetchService not available, plugin manager will fetch directly");
    } else if (!("setFetch" in this.#pluginManager)) {
      logger.debug("Plugin manager does not support FetchCapable, skipping fetch injection");
    } else {
      const fetchService = context.getServiceById(FETCH_SERVICE_ID) as FetchService;
      const adapter = new FetchInterfaceAdapter(fetchService, this.#fetchInterfaceAdapterOptions);
      (this.#pluginManager as unknown as FetchCapable).setFetch(adapter);
    }

    return Promise.resolve();
  }
}
