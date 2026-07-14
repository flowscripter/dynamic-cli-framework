import type { PluginService } from "@flowscripter/dynamic-cli-framework-api";
import type {
  MarketplacePluginManager,
  SearchQuery,
  VersionedPluginDescriptor,
} from "@flowscripter/dynamic-plugin-framework";

export default class DefaultPluginService implements PluginService {
  readonly #pluginManager: MarketplacePluginManager;

  constructor(pluginManager: MarketplacePluginManager) {
    this.#pluginManager = pluginManager;
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
