import { describe, expect, test } from "bun:test";
import type { MarketplacePluginManager } from "@flowscripter/dynamic-plugin-framework";
import DynamicPluginRuntimeCLI from "../../src/cli/DynamicPluginRuntimeCLI.ts";
import type CLIConfig from "../../src/api/CLIConfig.ts";
import type CommandFactory from "../../src/api/plugin/CommandFactory.ts";
import type ServiceProviderFactory from "../../src/api/plugin/ServiceProviderFactory.ts";
import { DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT } from "../../src/api/plugin/CommandFactory.ts";
import { DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT } from "../../src/api/plugin/ServiceProviderFactory.ts";
import type SubCommand from "../../src/api/command/SubCommand.ts";
import type { ServiceProvider, ServiceInfo } from "../../src/api/service/ServiceProvider.ts";
import type Context from "../../src/api/Context.ts";
import type { ArgumentValues } from "../../src/api/argument/ArgumentValueTypes.ts";
import { ArgumentValueTypeName } from "../../src/api/argument/ArgumentValueTypes.ts";
import { PLUGIN_SERVICE_ID } from "../../src/api/service/core/PluginService.ts";

function getCLIConfig(): CLIConfig {
  return { name: "testcli", description: "Test CLI", version: "1.0.0" };
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

const pluginServiceProvider: ServiceProvider = {
  serviceId: "PLUGIN_DEMO_SERVICE",
  servicePriority: 10,
  getServiceInfo: (_cliConfig: CLIConfig): Promise<ServiceInfo> =>
    Promise.resolve({ service: {}, commands: [] }),
  initService: (_context: Context) => Promise.resolve(),
};

const pluginServiceProviderFactory: ServiceProviderFactory = {
  getServiceProviders: () => [pluginServiceProvider],
};

function makeMockPluginManager(opts: {
  commandFactoryHandle?: string;
  spFactoryHandle?: string;
}): MarketplacePluginManager {
  return {
    search: async function* () {},
    install: async () => {},
    uninstall: async () => {},
    listInstalled: async function* () {},
    checkForUpdates: async function* () {},
    registerExtensions: async () => {},
    getRegisteredExtensions: async (ep: string) => {
      if (
        ep === DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT &&
        opts.commandFactoryHandle
      ) {
        return [{ extensionHandle: opts.commandFactoryHandle }];
      }
      if (
        ep === DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT &&
        opts.spFactoryHandle
      ) {
        return [{ extensionHandle: opts.spFactoryHandle }];
      }
      return [];
    },
    instantiate: async (handle: string) => {
      if (handle === opts.commandFactoryHandle) return pluginCommandFactory;
      if (handle === opts.spFactoryHandle) return pluginServiceProviderFactory;
      throw new Error(`Unknown handle: ${handle}`);
    },
  } as unknown as MarketplacePluginManager;
}

// Tests call loadPlugins() directly to avoid the process.exit() in DefaultRuntimeCLI.run().
// The integration of the full run() lifecycle is covered by functional tests.

describe("DynamicPluginRuntimeCLI", () => {
  test("constructs without error and registers DefaultPluginServiceProvider", () => {
    const cli = new DynamicPluginRuntimeCLI(getCLIConfig(), makeMockPluginManager({}));
    expect(cli).toBeInstanceOf(DynamicPluginRuntimeCLI);
  });

  test("loadPlugins() registers both extension points", async () => {
    const registered: string[] = [];
    const manager = {
      ...makeMockPluginManager({}),
      registerExtensions: async (ep: string) => {
        registered.push(ep);
      },
    } as unknown as MarketplacePluginManager;
    const cli = new DynamicPluginRuntimeCLI(getCLIConfig(), manager);
    await cli.loadPlugins();
    expect(registered).toContain(DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT);
    expect(registered).toContain(DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT);
  });

  test("loadPlugins() adds commands from a CommandFactory extension", async () => {
    const addedCommands: string[] = [];
    const originalAddCommand = DynamicPluginRuntimeCLI.prototype.addCommand;
    DynamicPluginRuntimeCLI.prototype.addCommand = function (cmd) {
      addedCommands.push(cmd.name);
      return originalAddCommand.call(this, cmd);
    };

    const manager = makeMockPluginManager({ commandFactoryHandle: "0:test-plugin:cmd" });
    const cli = new DynamicPluginRuntimeCLI(getCLIConfig(), manager);
    await cli.loadPlugins();

    DynamicPluginRuntimeCLI.prototype.addCommand = originalAddCommand;
    expect(addedCommands).toContain("plugin-demo");
  });

  test("loadPlugins() adds service providers from a ServiceProviderFactory extension", async () => {
    const addedProviders: string[] = [];
    const originalAddSP = DynamicPluginRuntimeCLI.prototype.addServiceProvider;
    DynamicPluginRuntimeCLI.prototype.addServiceProvider = function (sp) {
      addedProviders.push(sp.serviceId);
      return originalAddSP.call(this, sp);
    };

    const manager = makeMockPluginManager({ spFactoryHandle: "0:test-plugin:sp" });
    const cli = new DynamicPluginRuntimeCLI(getCLIConfig(), manager);
    await cli.loadPlugins();

    DynamicPluginRuntimeCLI.prototype.addServiceProvider = originalAddSP;
    expect(addedProviders).toContain(PLUGIN_SERVICE_ID);
    expect(addedProviders).toContain("PLUGIN_DEMO_SERVICE");
  });

  test("loadPlugins() throws when a factory instantiation fails", async () => {
    const manager = {
      ...makeMockPluginManager({ commandFactoryHandle: "bad-handle" }),
      instantiate: async () => {
        throw new Error("load error");
      },
    } as unknown as MarketplacePluginManager;
    const cli = new DynamicPluginRuntimeCLI(getCLIConfig(), manager);
    expect(cli.loadPlugins()).rejects.toThrow("load error");
  });
});
