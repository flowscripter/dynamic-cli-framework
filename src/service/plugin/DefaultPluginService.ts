import type { PluginService } from "@flowscripter/dynamic-cli-framework-api";
import type { KeyValueService } from "@flowscripter/dynamic-cli-framework-api";
import type {
  MarketplacePluginManager,
  SearchQuery,
  VersionedPluginDescriptor,
  NpmjsPluginRepositoryConfig,
  NpmPluginRepositoryConfig,
  FetchCapable,
  FetchInterface,
} from "@flowscripter/dynamic-plugin-framework";
import {
  NpmPluginManager,
  NpmjsPluginRepository,
  NpmPluginRepository,
} from "@flowscripter/dynamic-plugin-framework";

function isFetchCapable(value: unknown): value is FetchCapable {
  return typeof value === "object" && value !== null && "setFetch" in value;
}

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
    if (await keyValueService.has("remotes-config")) {
      remotesConfig = (await keyValueService.get(
        "remotes-config",
      )) as unknown as NpmjsPluginRepositoryConfig[];
    }
    let localConfig: NpmPluginRepositoryConfig = this.#defaultLocalConfig;
    if (await keyValueService.has("local-config")) {
      localConfig = (await keyValueService.get(
        "local-config",
      )) as unknown as NpmPluginRepositoryConfig;
    }
    this.#pluginManager = new NpmPluginManager(
      remotesConfig.map((config) => new NpmjsPluginRepository(config)),
      new NpmPluginRepository(localConfig),
    );
  }

  /**
   * Supply the {@link FetchInterface} for the underlying `pluginManager` to delegate fetch calls
   * to, so it respects the host CLI's shutdown handling and default timeout.
   */
  setFetch(fetchInterface: FetchInterface): void {
    if (isFetchCapable(this.#pluginManager)) {
      this.#pluginManager.setFetch(fetchInterface);
    }
  }

  async checkAvailable(pluginId: string, version?: string): Promise<boolean> {
    return this.#pluginManager.checkAvailable(pluginId, version);
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
