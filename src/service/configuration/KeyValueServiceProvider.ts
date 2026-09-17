import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import type {
  KeyValueService,
  ShutdownService,
  ValueNode,
} from "@flowscripter/dynamic-cli-framework-api";
import { KEY_VALUE_SERVICE_ID, SHUTDOWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultKeyValueService from "./DefaultKeyValueService.ts";
import DefaultSecretService from "./DefaultSecretService.ts";
import type ConfigurationServiceProvider from "./ConfigurationServiceProvider.ts";
import type { KeyValueServiceScopeType } from "./ConfigurationServiceProvider.ts";
import type DefaultContext from "../../runtime/DefaultContext.ts";

/**
 * Registered under {@link KEY_VALUE_SERVICE_ID} in the plain, undecorated {@link Context} purely
 * so {@link Context.doesServiceExist} reports correctly - every real access goes through a
 * per-scope instance from {@link KeyValueServiceProvider.getScopedKeyValueService}, applied
 * via a per-call decorated {@link Context} (see `runner.ts`). Reaching any of these methods
 * directly means that decoration was somehow bypassed.
 */
class UnreachableKeyValueService implements KeyValueService {
  get<T extends ValueNode>(): Promise<T> {
    return Promise.reject(new Error(UnreachableKeyValueService.#message));
  }

  has(): Promise<boolean> {
    return Promise.reject(new Error(UnreachableKeyValueService.#message));
  }

  set(): Promise<void> {
    return Promise.reject(new Error(UnreachableKeyValueService.#message));
  }

  delete(): Promise<void> {
    return Promise.reject(new Error(UnreachableKeyValueService.#message));
  }

  static readonly #message =
    "KeyValueService accessed without a resolved scope - this should be unreachable";
}

/**
 * Provides a generic, per-scope key-value store for commands and services ({@link KeyValueService}).
 *
 * The underlying data is read from/written to the same configuration file managed by
 * {@link ConfigurationServiceProvider} - see {@link ConfigurationServiceProvider.getKeyValueData} and
 * {@link ConfigurationServiceProvider.flushIfDirty}, reached via a direct constructor reference wired
 * up by `BaseCLI` (never via {@link Context}, since that would expose config-file read/write access
 * more broadly than intended).
 *
 * Its `serviceId` is {@link KEY_VALUE_SERVICE_ID} and its {@link ServiceInfo.service} is a
 * placeholder ({@link UnreachableKeyValueService}) - real access always goes through a per-consumer
 * decorated {@link Context} from {@link getContextForScope}, applied by `runner.ts`.
 *
 * Any node within a value passed to {@link KeyValueService.set} can be wrapped in {@link Secret} -
 * at any depth - to have that node, and only that node, stored as an OS-native secret. When a node
 * is wrapped in {@link Secret}, its value (of any shape) is JSON-serialized and stored as a single
 * OS-native secret via Bun.secrets, with a sentinel value of the format `__SECRET__:<bun_secret_name>`
 * substituted in its place in the structure that gets stored in the config file. Everything else in
 * the value is stored as plain (unencrypted) config data. The sentinel prefix `__SECRET__:` is
 * reserved and must not be used for regular key-value data.
 *
 * Independently of how a value was written, {@link KeyValueService.get} recursively resolves any
 * string leaf - at any depth within the retrieved value - which starts with the sentinel prefix,
 * via the OS secret store. This means a secret reference may also be hand-embedded (nested
 * arbitrarily deep) directly within a plain, non-secret value in the config file.
 *
 * Secret support requires `secretServiceEnabled=true` in the constructor (which also requires
 * `keyValueServiceEnabled=true` on the {@link ConfigurationServiceProvider} to have config enabled).
 *
 * As an example of the underlying config file structure:
 * ```
 * {
 *    "defaults": {
 *        ...
 *    },
 *    "key-values": {
 *        "commands": {
 *            "command1": {
 *               "foo1": "bar1",
 *               "foo2": "__SECRET__:command_command1_foo2",
 *               "foo3": {
 *                   "nested": ["a", "__SECRET__:command_command1_foo3_nested"]
 *               }
 *            },
 *            "command2": {
 *                "foo1": "bar3"
 *            }
 *        },
 *        "services": {
 *            "service-id-1": {
 *                "foo1": "bar"
 *            }
 *        }
 *    }
 * }
 * ```
 */
export default class KeyValueServiceProvider implements ServiceProvider {
  readonly serviceId: string = KEY_VALUE_SERVICE_ID;
  readonly servicePriority: number;

  readonly #configurationServiceProvider: ConfigurationServiceProvider;

  public readonly keyValueServiceEnabled: boolean;
  public readonly secretServiceEnabled: boolean;

  // per-scope KeyValueService instances, created on first request and cached thereafter - each is
  // bound permanently to one scope's Map (and one scope-prefixed DefaultSecretService), never
  // re-pointed. See getScopedKeyValueService().
  readonly #commandScopedKeyValueServices = new Map<string, DefaultKeyValueService>();
  readonly #serviceScopedKeyValueServices = new Map<string, DefaultKeyValueService>();

  // used to construct scoped DefaultSecretService instances on demand.
  #cliConfigName: string | undefined;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   * @param configurationServiceProvider the {@link ConfigurationServiceProvider} whose config file
   * backs this provider's data - an internal wiring reference, never exposed further.
   * @param keyValueServiceEnabled optionally provide a {@link KeyValueService} implementation: `configurationServiceProvider.configEnabled` must be true in this case
   * @param secretServiceEnabled optionally enable OS-native secret storage via Bun.secrets: `configurationServiceProvider.configEnabled` must be true in this case
   */
  public constructor(
    servicePriority: number,
    configurationServiceProvider: ConfigurationServiceProvider,
    keyValueServiceEnabled = false,
    secretServiceEnabled = false,
  ) {
    if (!configurationServiceProvider.configEnabled && keyValueServiceEnabled) {
      throw new Error("configEnabled must be true if keyValueServiceEnabled is true");
    }
    if (!configurationServiceProvider.configEnabled && secretServiceEnabled) {
      throw new Error("configEnabled must be true if secretServiceEnabled is true");
    }
    this.servicePriority = servicePriority;
    this.#configurationServiceProvider = configurationServiceProvider;
    this.keyValueServiceEnabled = keyValueServiceEnabled;
    this.secretServiceEnabled = secretServiceEnabled;
  }

  public getServiceInfo(cliConfig: CLIConfig): Promise<ServiceInfo> {
    this.#cliConfigName = cliConfig.name;
    return Promise.resolve({
      // this is a placeholder - see UnreachableKeyValueService - unless neither is enabled
      service:
        this.keyValueServiceEnabled || this.secretServiceEnabled
          ? new UnreachableKeyValueService()
          : undefined,
      commands: [],
    });
  }

  /**
   * Return the {@link KeyValueService} bound to the given scope, creating (and caching) it on
   * first request. The returned instance is permanently bound to that scope's data and secret
   * prefix - it is never re-pointed, so it may be held and used for as long as its owning
   * command/service/task is alive without racing any other scope's window.
   *
   * @param scopeType whether `scopeKey` is a command name or a service/task ID.
   * @param scopeKey the command name or service/task ID to scope the key-value data to.
   *
   * @throws {Error} if neither `keyValueServiceEnabled` nor `secretServiceEnabled` is set.
   */
  public getScopedKeyValueService(
    scopeType: KeyValueServiceScopeType,
    scopeKey: string,
  ): KeyValueService {
    if (!this.keyValueServiceEnabled && !this.secretServiceEnabled) {
      throw new Error(`Attempt to use KeyValueService/SecretService which is not enabled`);
    }

    const scopedServices =
      scopeType === "command"
        ? this.#commandScopedKeyValueServices
        : this.#serviceScopedKeyValueServices;
    const cached = scopedServices.get(scopeKey);
    if (cached) {
      return cached;
    }

    const keyValueData = this.#configurationServiceProvider.getKeyValueData(scopeType, scopeKey);

    const secretService = this.secretServiceEnabled
      ? new DefaultSecretService(this.#cliConfigName!, `${scopeType}_${scopeKey}`)
      : undefined;
    const scopedService = new DefaultKeyValueService(keyValueData, secretService);
    scopedServices.set(scopeKey, scopedService);
    return scopedService;
  }

  /**
   * Return a {@link Context} which delegates every lookup to `context` unchanged, except
   * `getServiceById(KEY_VALUE_SERVICE_ID)`, which resolves to the scope-bound instance from
   * {@link getScopedKeyValueService} for the given scope. Used by `runner.ts` to give each
   * command/service/task a KeyValueService isolated to its own scope, invisibly at the call site.
   *
   * Returns `context` itself, unchanged, if neither `keyValueServiceEnabled` nor
   * `secretServiceEnabled` is set.
   *
   * Also forwards `addServiceInstance`, even though it is not part of the {@link Context}
   * interface: `runner.ts` applies this same scoping to every `ServiceProvider`'s `initService()`
   * call (scope "service"), and `PluginServiceProvider.initService()` relies on casting its
   * received `context` to `DefaultContext` to register services discovered from plugins at
   * runtime - a capability every `ServiceProvider` already had before this scoping was
   * introduced, since `initService()` always received the real `DefaultContext` directly.
   */
  public getContextForScope(
    context: Context,
    scopeType: KeyValueServiceScopeType,
    scopeKey: string,
  ): Context {
    if (!this.keyValueServiceEnabled && !this.secretServiceEnabled) {
      return context;
    }
    const scopedKeyValueService = this.getScopedKeyValueService(scopeType, scopeKey);
    return {
      cliConfig: context.cliConfig,
      getServiceById: (id: string): unknown =>
        id === KEY_VALUE_SERVICE_ID ? scopedKeyValueService : context.getServiceById(id),
      doesServiceExist: (id: string): boolean => context.doesServiceExist(id),
      addServiceInstance: (id: string, serviceInstance: unknown): void =>
        (context as DefaultContext).addServiceInstance(id, serviceInstance),
    } as Context;
  }

  /**
   * Flush every scoped KeyValueService's data to the configuration file, if any of them report
   * themselves dirty. Registered as a low-priority ShutdownTask (see {@link initService}) so it
   * runs once, after other shutdown cleanup, regardless of how long any scope was written to.
   */
  async #flushDirtyScopes(): Promise<void> {
    const anyDirty = [
      ...this.#commandScopedKeyValueServices.values(),
      ...this.#serviceScopedKeyValueServices.values(),
    ].some((service) => service.isDirty());
    await this.#configurationServiceProvider.flushIfDirty(anyDirty);
  }

  public async initService(context: Context): Promise<void> {
    if (this.keyValueServiceEnabled || this.secretServiceEnabled) {
      const shutdownService = context.getServiceById(SHUTDOWN_SERVICE_ID) as ShutdownService;
      shutdownService.registerTask({
        id: `${KEY_VALUE_SERVICE_ID}-flush`,
        // low priority - shutdown tasks run in descending priority order, so this runs after
        // other shutdown cleanup (which defaults to priority 0).
        priority: -100,
        run: () => this.#flushDirtyScopes(),
      });
    }
  }
}
