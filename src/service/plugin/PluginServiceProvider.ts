import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService, SpawnService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID, SPAWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { FetchService } from "@flowscripter/dynamic-cli-framework-api";
import { FETCH_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { KEY_VALUE_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { KeyValueService } from "@flowscripter/dynamic-cli-framework-api";
import { DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT } from "@flowscripter/dynamic-cli-framework-api";
import { DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT } from "@flowscripter/dynamic-cli-framework-api";
import type { CommandFactory } from "@flowscripter/dynamic-cli-framework-api";
import type { ServiceProviderFactory } from "@flowscripter/dynamic-cli-framework-api";
import type {
  FetchCapable,
  NpmjsPluginRepositoryConfig,
  NpmPluginRepositoryConfig,
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
import DefaultCommandRegistry from "../../runtime/registry/DefaultCommandRegistry.ts";
import DefaultServiceProviderRegistry from "../../runtime/registry/DefaultServiceProviderRegistry.ts";
import type DefaultContext from "../../runtime/DefaultContext.ts";
import getLogger from "../../util/logger.ts";

const logger = getLogger("PluginServiceProvider");

export default class PluginServiceProvider implements ServiceProvider {
  readonly serviceId = PLUGIN_SERVICE_ID;
  readonly servicePriority: number;
  readonly #remoteConfig: NpmjsPluginRepositoryConfig;
  readonly #localConfig: NpmPluginRepositoryConfig;
  readonly #commandRegistry: DefaultCommandRegistry;
  readonly #serviceProviderRegistry: DefaultServiceProviderRegistry;
  readonly #spawnInterfaceAdapterOptions: SpawnInterfaceAdapterOptions;
  readonly #fetchInterfaceAdapterOptions: FetchInterfaceAdapterOptions;
  #pluginService: DefaultPluginService | undefined;
  #cliConfig: CLIConfig | undefined;

  constructor(
    servicePriority: number,
    remoteConfig: NpmjsPluginRepositoryConfig,
    localConfig: NpmPluginRepositoryConfig,
    commandRegistry: DefaultCommandRegistry,
    serviceProviderRegistry: DefaultServiceProviderRegistry,
    spawnInterfaceAdapterOptions: SpawnInterfaceAdapterOptions = {},
    fetchInterfaceAdapterOptions: FetchInterfaceAdapterOptions = {},
  ) {
    this.servicePriority = servicePriority;
    this.#remoteConfig = remoteConfig;
    this.#localConfig = localConfig;
    this.#commandRegistry = commandRegistry;
    this.#serviceProviderRegistry = serviceProviderRegistry;
    this.#spawnInterfaceAdapterOptions = spawnInterfaceAdapterOptions;
    this.#fetchInterfaceAdapterOptions = fetchInterfaceAdapterOptions;
  }

  async getServiceInfo(cliConfig: CLIConfig): Promise<ServiceInfo> {
    this.#cliConfig = cliConfig;
    this.#pluginService = new DefaultPluginService(this.#remoteConfig, this.#localConfig);
    return {
      service: this.#pluginService,
      commands: [new PluginGroupCommand()],
    };
  }

  async initService(context: Context): Promise<void> {
    const pluginService = this.#pluginService!;

    if (context.doesServiceExist(KEY_VALUE_SERVICE_ID)) {
      const keyValueService = context.getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService;
      await pluginService.applyKeyValueOverrides(keyValueService);
    }

    const pluginManager = pluginService.pluginManager;

    if (!context.doesServiceExist(SPAWN_SERVICE_ID)) {
      logger.debug("SpawnService not available, plugin manager will spawn processes directly");
    } else if (!("setSpawn" in pluginManager)) {
      logger.debug("Plugin manager does not support SpawnCapable, skipping spawn injection");
    } else {
      const spawnService = context.getServiceById(SPAWN_SERVICE_ID) as SpawnService;
      const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
      const adapter = new SpawnInterfaceAdapter(
        spawnService,
        printerService,
        this.#spawnInterfaceAdapterOptions,
      );
      (pluginManager as unknown as SpawnCapable).setSpawn(adapter);
    }

    if (!context.doesServiceExist(FETCH_SERVICE_ID)) {
      logger.debug("FetchService not available, plugin manager will fetch directly");
    } else if (!("setFetch" in pluginManager)) {
      logger.debug("Plugin manager does not support FetchCapable, skipping fetch injection");
    } else {
      const fetchService = context.getServiceById(FETCH_SERVICE_ID) as FetchService;
      const adapter = new FetchInterfaceAdapter(fetchService, this.#fetchInterfaceAdapterOptions);
      (pluginManager as unknown as FetchCapable).setFetch(adapter);
    }

    await pluginManager.registerExtensions(DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT);
    await pluginManager.registerExtensions(
      DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT,
    );

    const commandFactoryExtensions = await pluginManager.getRegisteredExtensions(
      DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT,
    );
    for (const ext of commandFactoryExtensions) {
      const factory = (await pluginManager.instantiate(ext.extensionHandle)) as CommandFactory;
      for (const command of factory.getCommands()) {
        this.#commandRegistry.addCommand(command);
      }
    }

    const spFactoryExtensions = await pluginManager.getRegisteredExtensions(
      DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT,
    );
    for (const ext of spFactoryExtensions) {
      const factory = (await pluginManager.instantiate(
        ext.extensionHandle,
      )) as ServiceProviderFactory;
      for (const sp of factory.getServiceProviders()) {
        const info = await sp.getServiceInfo(this.#cliConfig!);
        if (info.service) {
          (context as DefaultContext).addServiceInstance(sp.serviceId, info.service);
        }
        info.commands.forEach((cmd) => this.#commandRegistry.addCommand(cmd, sp.serviceId));
        this.#serviceProviderRegistry.addServiceProvider(sp);
      }
    }
  }
}
