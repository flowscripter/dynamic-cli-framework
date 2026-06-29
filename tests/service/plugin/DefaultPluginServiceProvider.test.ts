import { describe, expect, test } from "bun:test";
import DefaultPluginServiceProvider from "../../../src/service/plugin/DefaultPluginServiceProvider.ts";
import { PLUGIN_SERVICE_ID } from "../../../src/api/service/core/PluginService.ts";
import type { MarketplacePluginManager } from "@flowscripter/dynamic-plugin-framework";
import type CLIConfig from "../../../src/api/CLIConfig.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { PluginGroupCommand } from "../../../src/command/PluginCommand.ts";

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
});
