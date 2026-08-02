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
  #remoteConfigs: NpmjsPluginRepositoryConfig[];
  #fetchFn: FetchInterface["fetch"] = (input, init) => fetch(input, init);

  constructor(remoteConfig: NpmjsPluginRepositoryConfig, localConfig: NpmPluginRepositoryConfig) {
    this.#defaultRemoteConfig = remoteConfig;
    this.#defaultLocalConfig = localConfig;
    this.#remoteConfigs = [remoteConfig];
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
    this.#remoteConfigs = remotesConfig;
    this.#pluginManager = new NpmPluginManager(
      remotesConfig.map((config) => new NpmjsPluginRepository(config)),
      new NpmPluginRepository(localConfig),
    );
  }

  /**
   * Supply the {@link FetchInterface} to delegate fetch calls to - both for the underlying
   * `pluginManager` (search/install) and for this service's own direct registry existence
   * checks (see {@link assertPluginAvailable}), so both respect the host CLI's shutdown
   * handling and default timeout.
   */
  setFetch(fetchInterface: FetchInterface): void {
    this.#fetchFn = fetchInterface.fetch.bind(fetchInterface);
    if (isFetchCapable(this.#pluginManager)) {
      this.#pluginManager.setFetch(fetchInterface);
    }
  }

  #buildHeaders(config: NpmjsPluginRepositoryConfig): Headers {
    const headers = new Headers();
    if (config.authToken) {
      headers.set("Authorization", `Bearer ${config.authToken}`);
    } else if (config.username !== undefined && config.password !== undefined) {
      headers.set("Authorization", `Basic ${btoa(`${config.username}:${config.password}`)}`);
    }
    return headers;
  }

  async #existsInAnyRemote(pluginId: string, version?: string): Promise<boolean> {
    for (const config of this.#remoteConfigs) {
      const path = version ? `${pluginId}/${version}` : pluginId;
      const response = await this.#fetchFn(`${config.registryUrl}/${path}`, {
        headers: this.#buildHeaders(config),
      });
      if (response.ok) {
        return true;
      }
    }
    return false;
  }

  /**
   * Confirm that a plugin package (and, if given, a specific version or dist-tag of it) actually
   * exists on at least one of the configured remote registries, via a direct lookup against each
   * registry's package metadata endpoint - not the fuzzy/ranked marketplace `search()`.
   *
   * Intended to be called before {@link install}, so a plugin/version that doesn't exist is
   * reported with a clear error instead of being handed to the underlying package manager
   * (`bun add`/`npm install`), whose own failure is slower to surface and less direct.
   *
   * @param pluginId the package identifier to check (e.g. `@scope/name`).
   * @param version optional specific version or dist-tag to additionally check for. Skipped when
   * omitted or `"latest"`, since `"latest"` is always resolvable if the package itself exists.
   *
   * @throws if the package (or the specific version/tag) is not found on any configured remote.
   */
  async assertPluginAvailable(pluginId: string, version?: string): Promise<void> {
    if (!(await this.#existsInAnyRemote(pluginId))) {
      throw new Error(`Plugin ${pluginId} was not found in the configured plugin registry`);
    }
    if (version && version !== "latest" && !(await this.#existsInAnyRemote(pluginId, version))) {
      throw new Error(
        `Version ${version} of plugin ${pluginId} was not found in the configured plugin registry`,
      );
    }
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
