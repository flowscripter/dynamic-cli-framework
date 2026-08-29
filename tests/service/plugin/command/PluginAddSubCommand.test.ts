import { describe, expect, test } from "bun:test";
import type {
  SearchQuery,
  VersionedPluginDescriptor,
} from "@flowscripter/dynamic-plugin-framework";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import { PluginAddSubCommand } from "../../../../src/service/plugin/command/PluginAddSubCommand.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { PLUGIN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { PluginService } from "@flowscripter/dynamic-cli-framework-api";

function buildContext(): {
  context: DefaultContext;
  messages: { print: string[]; info: string[]; spinner: string[]; spinnerHidden: number };
} {
  const context = new DefaultContext(getCLIConfig());
  const messages = {
    print: [] as string[],
    info: [] as string[],
    spinner: [] as string[],
    spinnerHidden: 0,
  };
  context.addServiceInstance(PRINTER_SERVICE_ID, {
    print: (msg: string) => {
      messages.print.push(msg);
      return Promise.resolve();
    },
    info: (msg: string) => {
      messages.info.push(msg);
      return Promise.resolve();
    },
    showSpinner: (msg: string) => {
      messages.spinner.push(msg);
      return Promise.resolve();
    },
    hideSpinner: () => {
      messages.spinnerHidden += 1;
      return Promise.resolve();
    },
  });
  return { context, messages };
}

const descriptor: VersionedPluginDescriptor = {
  pluginId: "@scope/plugin",
  scope: "scope",
  name: "plugin",
  version: "1.0.0",
  extensionPoints: [],
};

describe("PluginAddSubCommand", () => {
  test("shows a spinner for search and install", async () => {
    const { context, messages } = buildContext();

    const fakePluginService: PluginService = {
      search: async function* (_query: Readonly<SearchQuery>) {
        yield descriptor;
      },
      checkAvailable: async () => true,
      install: async () => {},
      uninstall: async () => {},
      listInstalled: async function* () {},
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await command.execute(context, { pluginId: descriptor.pluginId });

    expect(messages.spinner).toEqual([
      "Searching for plugin: @scope/plugin",
      "Installing @scope/plugin@1.0.0...",
    ]);
    expect(messages.spinnerHidden).toEqual(2);
  });

  test("strips the version from the specifier before searching, and passes it to install", async () => {
    const { context, messages } = buildContext();

    const searchQueries: Readonly<SearchQuery>[] = [];
    let installedDescriptor: VersionedPluginDescriptor | undefined;
    const fakePluginService: PluginService = {
      search: async function* (query: Readonly<SearchQuery>) {
        searchQueries.push(query);
        yield descriptor;
      },
      checkAvailable: async () => true,
      install: async (d: Readonly<VersionedPluginDescriptor>) => {
        installedDescriptor = d as VersionedPluginDescriptor;
      },
      uninstall: async () => {},
      listInstalled: async function* () {},
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await command.execute(context, { pluginId: `${descriptor.pluginId}@3.0.0` });

    expect(searchQueries).toEqual([{ text: descriptor.pluginId }]);
    expect(installedDescriptor?.version).toEqual("3.0.0");
    expect(messages.spinner).toEqual([
      "Searching for plugin: @scope/plugin@3.0.0",
      "Installing @scope/plugin@3.0.0...",
    ]);
  });

  test("passes a non-semver version tag (e.g. latest) through to install unchanged", async () => {
    const { context } = buildContext();

    let installedDescriptor: VersionedPluginDescriptor | undefined;
    const fakePluginService: PluginService = {
      search: async function* (_query: Readonly<SearchQuery>) {
        yield descriptor;
      },
      checkAvailable: async () => true,
      install: async (d: Readonly<VersionedPluginDescriptor>) => {
        installedDescriptor = d as VersionedPluginDescriptor;
      },
      uninstall: async () => {},
      listInstalled: async function* () {},
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await command.execute(context, { pluginId: `${descriptor.pluginId}@latest` });

    expect(installedDescriptor?.version).toEqual("latest");
  });

  test("falls back to direct install with parsed version when search finds no match", async () => {
    const { context, messages } = buildContext();

    const searchQueries: Readonly<SearchQuery>[] = [];
    let installedDescriptor: VersionedPluginDescriptor | undefined;
    const fakePluginService: PluginService = {
      search: async function* (query: Readonly<SearchQuery>) {
        searchQueries.push(query);
        yield* [];
      },
      checkAvailable: async () => true,
      install: async (d: Readonly<VersionedPluginDescriptor>) => {
        installedDescriptor = d as VersionedPluginDescriptor;
      },
      uninstall: async () => {},
      listInstalled: async function* () {},
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await command.execute(context, { pluginId: "@other/plugin@2.5.0" });

    expect(searchQueries).toEqual([{ text: "@other/plugin" }]);
    expect(installedDescriptor?.pluginId).toEqual("@other/plugin");
    expect(installedDescriptor?.version).toEqual("2.5.0");
    expect(messages.spinner).toEqual([
      "Searching for plugin: @other/plugin@2.5.0",
      "Installing @other/plugin@2.5.0...",
    ]);
    expect(messages.info).toEqual([
      "Plugin not found via search, attempting direct install of @other/plugin@2.5.0...\n",
    ]);
  });

  test("checks availability before install and installs when it resolves", async () => {
    const { context } = buildContext();

    let installCalled = false;
    let checkedPluginId: string | undefined;
    let checkedVersion: string | undefined;
    const fakePluginService: PluginService = {
      search: async function* (_query: Readonly<SearchQuery>) {
        yield descriptor;
      },
      checkAvailable: async (pluginId: string, version?: string) => {
        checkedPluginId = pluginId;
        checkedVersion = version;
        return true;
      },
      install: async () => {
        installCalled = true;
      },
      uninstall: async () => {},
      listInstalled: async function* () {},
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await command.execute(context, { pluginId: `${descriptor.pluginId}@3.0.0` });

    expect(checkedPluginId).toEqual(descriptor.pluginId);
    expect(checkedVersion).toEqual("3.0.0");
    expect(installCalled).toBeTrue();
  });

  test("does not install when the availability check resolves false", async () => {
    const { context } = buildContext();

    let installCalled = false;
    const fakePluginService: PluginService = {
      search: async function* (_query: Readonly<SearchQuery>) {
        yield descriptor;
      },
      checkAvailable: async () => false,
      install: async () => {
        installCalled = true;
      },
      uninstall: async () => {},
      listInstalled: async function* () {},
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await expect(
      command.execute(context, { pluginId: `${descriptor.pluginId}@9.9.9` }),
    ).rejects.toThrow(
      "Version 9.9.9 of plugin @scope/plugin was not found in the configured plugin registry",
    );

    expect(installCalled).toBeFalse();
  });

  test("skips the version check when the resolved version is 'latest'", async () => {
    const { context } = buildContext();

    let checkedVersion: string | undefined;
    const fakePluginService: PluginService = {
      search: async function* (_query: Readonly<SearchQuery>) {
        yield* [];
      },
      checkAvailable: async (_pluginId: string, version?: string) => {
        checkedVersion = version;
        return true;
      },
      install: async () => {},
      uninstall: async () => {},
      listInstalled: async function* () {},
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await command.execute(context, { pluginId: "@other/plugin" });

    expect(checkedVersion).toBeUndefined();
  });

  test("confirms the explicitly requested version in the installed message", async () => {
    const { context, messages } = buildContext();

    const installedDescriptor: VersionedPluginDescriptor = { ...descriptor, version: "3.0.0" };
    const fakePluginService: PluginService = {
      search: async function* (_query: Readonly<SearchQuery>) {
        yield descriptor;
      },
      checkAvailable: async () => true,
      install: async () => {},
      uninstall: async () => {},
      listInstalled: async function* () {
        yield installedDescriptor;
      },
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await command.execute(context, { pluginId: `${descriptor.pluginId}@3.0.0` });

    expect(messages.print).toEqual(["Plugin @scope/plugin@3.0.0 installed.\n"]);
  });

  test("shows the actually-resolved latest version in the installed message, not the literal 'latest'", async () => {
    const { context, messages } = buildContext();

    const resolvedDescriptor: VersionedPluginDescriptor = { ...descriptor, version: "4.2.1" };
    const fakePluginService: PluginService = {
      // Not found via search, so PluginAddSubCommand falls back to a direct install with
      // descriptor.version left as the literal placeholder "latest".
      search: async function* (_query: Readonly<SearchQuery>) {
        yield* [];
      },
      checkAvailable: async () => true,
      install: async () => {},
      uninstall: async () => {},
      listInstalled: async function* () {
        yield resolvedDescriptor;
      },
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await command.execute(context, { pluginId: descriptor.pluginId });

    expect(messages.print).toEqual(["Plugin @scope/plugin@4.2.1 installed.\n"]);
  });
});
