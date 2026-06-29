import type {
  VersionedPluginDescriptor,
  SearchQuery,
} from "@flowscripter/dynamic-plugin-framework";

/**
 * Service ID for {@link PluginService}.
 *
 * Pass to {@link Context.getServiceById} to retrieve the active {@link PluginService} instance.
 */
export const PLUGIN_SERVICE_ID = "PLUGIN_SERVICE";

/**
 * Service providing plugin lifecycle management for a CLI with dynamic plugin support.
 *
 * Exposes search, install, uninstall, list, and update operations backed by a
 * {@link MarketplacePluginManager}. Provided by {@link DefaultPluginServiceProvider}
 * when plugin support is enabled via {@link DynamicPluginRuntimeCLI}.
 *
 * After {@link install} or an upgrade, the CLI must be restarted for new or updated
 * plugin commands and service providers to become active.
 */
export default interface PluginService {
  /**
   * Search the remote marketplace for plugins matching the given query.
   *
   * @param query criteria to filter results by.
   * @returns an async iterable of matching {@link VersionedPluginDescriptor} entries.
   */
  search(query: Readonly<SearchQuery>): AsyncIterable<Readonly<VersionedPluginDescriptor>>;

  /**
   * Install a plugin from the remote marketplace into the local plugin store.
   *
   * @param descriptor the plugin to install, as returned by {@link search}.
   */
  install(descriptor: Readonly<VersionedPluginDescriptor>): Promise<void>;

  /**
   * Remove a previously installed plugin from the local plugin store.
   *
   * @param pluginId the package identifier of the plugin to remove (e.g. `@scope/my-plugin`).
   */
  uninstall(pluginId: string): Promise<void>;

  /**
   * List all plugins currently installed in the local plugin store.
   *
   * @returns an async iterable of {@link VersionedPluginDescriptor} entries for each installed plugin.
   */
  listInstalled(): AsyncIterable<Readonly<VersionedPluginDescriptor>>;

  /**
   * Check each installed plugin for a newer version available on the remote marketplace.
   *
   * @returns an async iterable of objects pairing the installed plugin descriptor with the
   * latest available version string for plugins that have an update available.
   */
  checkForUpdates(): AsyncIterable<{
    descriptor: Readonly<VersionedPluginDescriptor>;
    availableVersion: string;
  }>;
}
