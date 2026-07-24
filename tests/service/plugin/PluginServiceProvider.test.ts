import { describe, expect, test } from "bun:test";
import PluginServiceProvider from "../../../src/service/plugin/PluginServiceProvider.ts";
import {
  PLUGIN_SERVICE_ID,
  PRINTER_SERVICE_ID,
  SPAWN_SERVICE_ID,
  KEY_VALUE_SERVICE_ID,
  DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT,
  DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT,
  ArgumentValueTypeName,
} from "@flowscripter/dynamic-cli-framework-api";
import type {
  CLIConfig,
  Context,
  ArgumentValues,
  SubCommand,
  ServiceProvider,
  ServiceInfo,
  CommandFactory,
  ServiceProviderFactory,
  KeyValueService,
} from "@flowscripter/dynamic-cli-framework-api";
import type {
  NpmjsPluginRepositoryConfig,
  NpmPluginRepositoryConfig,
} from "@flowscripter/dynamic-plugin-framework";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import DefaultCommandRegistry from "../../../src/runtime/registry/DefaultCommandRegistry.ts";
import DefaultServiceProviderRegistry from "../../../src/runtime/registry/DefaultServiceProviderRegistry.ts";
import DefaultPluginService from "../../../src/service/plugin/DefaultPluginService.ts";
import { PluginGroupCommand } from "../../../src/service/plugin/command/PluginGroupCommand.ts";

function getCLIConfig(): CLIConfig {
  return { name: "testcli", description: "Test CLI", version: "1.0.0" };
}

function getRemoteConfig(): NpmjsPluginRepositoryConfig {
  return { name: "remote", registryUrl: "https://registry.npmjs.org", packageJsonNamespace: "ns" };
}

function getLocalConfig(): NpmPluginRepositoryConfig {
  return { nodeModulesPath: "/tmp/node_modules", packageJsonNamespace: "ns" };
}

const pluginSubCommand: SubCommand = {
  name: "plugin-demo",
  description: "Demo command from plugin",
  enableConfiguration: false,
  options: [],
  positionals: [
    {
      name: "val",
      description: "value",
      type: ArgumentValueTypeName.STRING,
      isVarargOptional: true,
    },
  ],
  execute: (_context: Context, _argumentValues: ArgumentValues) => Promise.resolve(),
};

const pluginCommandFactory: CommandFactory = {
  getCommands: () => [pluginSubCommand],
};

function makePluginServiceProviderFactory(): ServiceProviderFactory {
  const demoServiceProvider: ServiceProvider = {
    serviceId: "PLUGIN_DEMO_SERVICE",
    servicePriority: 10,
    getServiceInfo: (_cliConfig: CLIConfig): Promise<ServiceInfo> =>
      Promise.resolve({ service: { demo: true }, commands: [] }),
    initService: (_context: Context) => Promise.resolve(),
  };
  return { getServiceProviders: () => [demoServiceProvider] };
}

// Monkey-patches the real pluginManager underlying a DefaultPluginService so that
// registerExtensions/getRegisteredExtensions/instantiate return fake plugin extensions,
// without needing to add a way to inject a custom MarketplacePluginManager.
function stubPluginManager(
  pluginService: DefaultPluginService,
  opts: { commandFactoryHandle?: string; spFactoryHandle?: string },
): void {
  const pluginManager = pluginService.pluginManager as unknown as Record<string, unknown>;
  pluginManager["registerExtensions"] = async () => {};
  pluginManager["getRegisteredExtensions"] = async (ep: string) => {
    if (ep === DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT && opts.commandFactoryHandle) {
      return [{ extensionHandle: opts.commandFactoryHandle }];
    }
    if (
      ep === DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT &&
      opts.spFactoryHandle
    ) {
      return [{ extensionHandle: opts.spFactoryHandle }];
    }
    return [];
  };
  pluginManager["instantiate"] = async (handle: string) => {
    if (handle === opts.commandFactoryHandle) return pluginCommandFactory;
    if (handle === opts.spFactoryHandle) return makePluginServiceProviderFactory();
    throw new Error(`Unknown handle: ${handle}`);
  };
}

describe("PluginServiceProvider", () => {
  test("has correct serviceId and servicePriority", () => {
    const provider = new PluginServiceProvider(
      50,
      getRemoteConfig(),
      getLocalConfig(),
      new DefaultCommandRegistry(),
      new DefaultServiceProviderRegistry(),
    );
    expect(provider.serviceId).toEqual(PLUGIN_SERVICE_ID);
    expect(provider.servicePriority).toEqual(50);
  });

  test("getServiceInfo returns a PluginService instance and the plugin GroupCommand", async () => {
    const provider = new PluginServiceProvider(
      50,
      getRemoteConfig(),
      getLocalConfig(),
      new DefaultCommandRegistry(),
      new DefaultServiceProviderRegistry(),
    );
    const info = await provider.getServiceInfo(getCLIConfig());
    expect(info.service).toBeInstanceOf(DefaultPluginService);
    expect(info.commands).toHaveLength(1);
    expect(info.commands[0]).toBeInstanceOf(PluginGroupCommand);
  });

  test("initService applies KeyValueService overrides when available", async () => {
    const commandRegistry = new DefaultCommandRegistry();
    const serviceProviderRegistry = new DefaultServiceProviderRegistry();
    const provider = new PluginServiceProvider(
      50,
      getRemoteConfig(),
      getLocalConfig(),
      commandRegistry,
      serviceProviderRegistry,
    );
    const info = await provider.getServiceInfo(getCLIConfig());
    const pluginService = info.service as DefaultPluginService;
    stubPluginManager(pluginService, {});
    const originalPluginManager = pluginService.pluginManager;

    const context = new DefaultContext(getCLIConfig());
    let hasKeyCalled = false;
    const keyValueService: KeyValueService = {
      hasKey: (key: string) => {
        if (key === "remotes-config" || key === "local-config") {
          hasKeyCalled = true;
        }
        return Promise.resolve(false);
      },
      getKey: () => Promise.resolve(""),
      setKey: () => Promise.resolve(),
    } as unknown as KeyValueService;
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, keyValueService);

    await provider.initService(context);

    expect(hasKeyCalled).toBeTrue();
    // applyKeyValueOverrides always rebuilds the pluginManager
    expect(pluginService.pluginManager).not.toBe(originalPluginManager);
  });

  test("initService injects SpawnInterfaceAdapter when SpawnService is registered", async () => {
    const provider = new PluginServiceProvider(
      50,
      getRemoteConfig(),
      getLocalConfig(),
      new DefaultCommandRegistry(),
      new DefaultServiceProviderRegistry(),
    );
    const info = await provider.getServiceInfo(getCLIConfig());
    const pluginService = info.service as DefaultPluginService;
    stubPluginManager(pluginService, {});

    let injectedSpawn: unknown;
    (pluginService.pluginManager as unknown as Record<string, unknown>)["setSpawn"] = (
      spawn: unknown,
    ) => {
      injectedSpawn = spawn;
    };

    const context = new DefaultContext(getCLIConfig());
    context.addServiceInstance(SPAWN_SERVICE_ID, {
      spawn: () => Promise.resolve({ ok: true, exitCode: 0 }),
    });
    context.addServiceInstance(PRINTER_SERVICE_ID, {
      startQuote: () => {},
      endQuote: () => {},
      startMark: () => {},
      endMark: () => {},
      clearMarked: () => Promise.resolve(),
      info: () => Promise.resolve(),
    });

    await provider.initService(context);

    expect(injectedSpawn).toBeDefined();
  });

  test("initService registers discovered commands and service providers from plugin extensions", async () => {
    const commandRegistry = new DefaultCommandRegistry();
    const serviceProviderRegistry = new DefaultServiceProviderRegistry();
    const provider = new PluginServiceProvider(
      50,
      getRemoteConfig(),
      getLocalConfig(),
      commandRegistry,
      serviceProviderRegistry,
    );
    const info = await provider.getServiceInfo(getCLIConfig());
    const pluginService = info.service as DefaultPluginService;
    stubPluginManager(pluginService, {
      commandFactoryHandle: "0:test-plugin:cmd",
      spFactoryHandle: "0:test-plugin:sp",
    });

    const context = new DefaultContext(getCLIConfig());
    await provider.initService(context);

    expect(commandRegistry.getSubCommandByName("plugin-demo")).toBeDefined();
    expect(
      serviceProviderRegistry
        .getServiceProviders()
        .some((sp) => sp.serviceId === "PLUGIN_DEMO_SERVICE"),
    ).toBeTrue();
    expect(context.doesServiceExist("PLUGIN_DEMO_SERVICE")).toBeTrue();
    expect(context.getServiceById("PLUGIN_DEMO_SERVICE")).toEqual({ demo: true });
  });
});
