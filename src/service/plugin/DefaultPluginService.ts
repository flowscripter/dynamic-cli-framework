import type { PluginService } from "@flowscripter/dynamic-cli-framework-api";
import type { KeyValueService } from "@flowscripter/dynamic-cli-framework-api";
import type {
  MarketplacePluginManager,
  SearchQuery,
  VersionedPluginDescriptor,
  NpmjsPluginRepositoryConfig,
  NpmPluginRepositoryConfig,
} from "@flowscripter/dynamic-plugin-framework";
import {
  NpmPluginManager,
  NpmjsPluginRepository,
  NpmPluginRepository,
} from "@flowscripter/dynamic-plugin-framework";

export default class DefaultPluginService implements PluginService {
  readonly #defaultRemoteConfig: NpmjsPluginRepositoryConfig;
  readonly #defaultLocalConfig: NpmPluginRepositoryConfig;
  #pluginManager: MarketplacePluginManager;

  constructor(remoteConfig: NpmjsPluginRepositoryConfig, localConfig: NpmPluginRepositoryConfig) {
    this.#defaultRemoteConfig = remoteConfig;
    this.#defaultLocalConfig = localConfig;
    this.#pluginManager = new NpmPluginManager(
      [new NpmjsPluginRepository(remoteConfig)],
      new NpmPluginRepository(localConfig),
    );
  }

  get pluginManager(): MarketplacePluginManager {
    return this.#pluginManager;
  }

  async applyKeyValueOverrides(keyValueService: KeyValueService): Promise<void> {
    let remotesConfig: NpmjsPluginRepositoryConfig[] = [this.#defaultRemoteConfig];
    if (await keyValueService.hasKey("remotes-config")) {
      remotesConfig = JSON.parse(
        await keyValueService.getKey("remotes-config"),
      ) as NpmjsPluginRepositoryConfig[];
    }
    let localConfig: NpmPluginRepositoryConfig = this.#defaultLocalConfig;
    if (await keyValueService.hasKey("local-config")) {
      localConfig = JSON.parse(
        await keyValueService.getKey("local-config"),
      ) as NpmPluginRepositoryConfig;
    }
    this.#pluginManager = new NpmPluginManager(
      remotesConfig.map((config) => new NpmjsPluginRepository(config)),
      new NpmPluginRepository(localConfig),
    );
  }

  search(query: Readonly<SearchQuery>): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    return this.#pluginManager.search(query);
  }

  async install(descriptor: Readonly<VersionedPluginDescriptor>): Promise<void> {
    await this.#pluginManager.install(descriptor);
  }

  async uninstall(pluginId: string): Promise<void> {
    await this.#pluginManager.uninstall(pluginId);
  }

  listInstalled(): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    return this.#pluginManager.listInstalled();
  }

  checkForUpdates(): AsyncIterable<{
    descriptor: Readonly<VersionedPluginDescriptor>;
    availableVersion: string;
  }> {
    return this.#pluginManager.checkForUpdates();
  }
}
