import { describe, expect, test } from "bun:test";
import DefaultPluginServiceProvider from "../../../src/service/plugin/DefaultPluginServiceProvider.ts";
import {
  PLUGIN_SERVICE_ID,
  PRINTER_SERVICE_ID,
  SPAWN_SERVICE_ID,
} from "@flowscripter/dynamic-cli-framework-api";
import type {
  MarketplacePluginManager,
  SpawnInterface,
} from "@flowscripter/dynamic-plugin-framework";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { PluginGroupCommand } from "../../../src/service/plugin/command/PluginGroupCommand.ts";

function getCLIConfig(): CLIConfig {
  return { name: "testcli", description: "Test CLI", version: "1.0.0" };
}

function makeMockPluginManager(): MarketplacePluginManager {
  return {
    search: async function* () {},
    install: async () => {},
    uninstall: async () => {},
    listInstalled: async function* () {},
    checkForUpdates: async function* () {},
    registerExtensions: async () => {},
    getRegisteredExtensions: async () => [],
    instantiate: async () => ({}),
  } as unknown as MarketplacePluginManager;
}

describe("DefaultPluginServiceProvider", () => {
  test("has correct serviceId", () => {
    const provider = new DefaultPluginServiceProvider(makeMockPluginManager());
    expect(provider.serviceId).toEqual(PLUGIN_SERVICE_ID);
  });

  test("has correct default servicePriority", () => {
    const provider = new DefaultPluginServiceProvider(makeMockPluginManager());
    expect(provider.servicePriority).toEqual(50);
  });

  test("respects custom servicePriority", () => {
    const provider = new DefaultPluginServiceProvider(makeMockPluginManager(), 30);
    expect(provider.servicePriority).toEqual(30);
  });

  test("getServiceInfo returns a PluginService instance", async () => {
    const provider = new DefaultPluginServiceProvider(makeMockPluginManager());
    const info = await provider.getServiceInfo(getCLIConfig());
    expect(info.service).toBeDefined();
  });

  test("getServiceInfo returns a single plugin GroupCommand", async () => {
    const provider = new DefaultPluginServiceProvider(makeMockPluginManager());
    const info = await provider.getServiceInfo(getCLIConfig());
    expect(info.commands).toHaveLength(1);
    expect(info.commands[0]).toBeInstanceOf(PluginGroupCommand);
    expect(info.commands[0]!.name).toEqual("plugin");
  });

  test("plugin GroupCommand has 5 member sub-commands", async () => {
    const provider = new DefaultPluginServiceProvider(makeMockPluginManager());
    const info = await provider.getServiceInfo(getCLIConfig());
    const group = info.commands[0] as PluginGroupCommand;
    expect(group.memberSubCommands).toHaveLength(5);
    const names = group.memberSubCommands.map((c) => c.name);
    expect(names).toContain("list");
    expect(names).toContain("search");
    expect(names).toContain("add");
    expect(names).toContain("remove");
    expect(names).toContain("upgrade");
  });

  test("initService completes without error", async () => {
    const provider = new DefaultPluginServiceProvider(makeMockPluginManager());
    const context = new DefaultContext(getCLIConfig());
    await provider.initService(context);
  });

  test("initService does not inject spawn when SpawnService is not registered", async () => {
    let setSpawnCalled = false;
    const pluginManager = {
      ...makeMockPluginManager(),
      setSpawn: () => {
        setSpawnCalled = true;
      },
    } as unknown as MarketplacePluginManager;
    const provider = new DefaultPluginServiceProvider(pluginManager);
    const context = new DefaultContext(getCLIConfig());

    await provider.initService(context);

    expect(setSpawnCalled).toBeFalse();
  });

  test("initService does not inject spawn when the plugin manager is not SpawnCapable", () => {
    const provider = new DefaultPluginServiceProvider(makeMockPluginManager());
    const context = new DefaultContext(getCLIConfig());
    context.addServiceInstance(SPAWN_SERVICE_ID, {
      spawn: () => Promise.resolve({ ok: true, exitCode: 0 }),
    });
    context.addServiceInstance(PRINTER_SERVICE_ID, {});

    // no setSpawn method on the mock manager - should not throw
    expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService injects a SpawnInterfaceAdapter when SpawnService is registered and the plugin manager is SpawnCapable", async () => {
    let injectedSpawn: SpawnInterface | undefined;
    const pluginManager = {
      ...makeMockPluginManager(),
      setSpawn: (spawn: SpawnInterface) => {
        injectedSpawn = spawn;
      },
    } as unknown as MarketplacePluginManager;
    const provider = new DefaultPluginServiceProvider(pluginManager);
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
});
