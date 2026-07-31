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
import DefaultPrinterService from "../../../../src/service/printer/DefaultPrinterService.ts";
import StreamString from "../../../fixtures/StreamString.ts";
import { expectStringEquals } from "../../../fixtures/util.ts";
import TtyTerminal from "../../../../src/terminal/TtyTerminal.ts";
import TtyStyler from "../../../../src/terminal/TtyStyler.ts";

function buildContext() {
  const dummyStdout = new StreamString();
  const dummyStderr = new StreamString();
  const printer = new DefaultPrinterService(
    dummyStdout.writableStream,
    dummyStderr.writableStream,
    true,
    true,
    new TtyTerminal(dummyStdout.writeStream),
    new TtyTerminal(dummyStderr.writeStream),
    new TtyStyler(3),
  );
  printer.colorEnabled = false;

  const context = new DefaultContext(getCLIConfig());
  context.addServiceInstance(PRINTER_SERVICE_ID, printer);

  return { context, dummyStderr };
}

const descriptor: VersionedPluginDescriptor = {
  pluginId: "@scope/plugin",
  scope: "scope",
  name: "plugin",
  version: "1.0.0",
  extensionPoints: [],
};

describe("PluginAddSubCommand", () => {
  test("prints search and install messages on separate lines", async () => {
    const { context, dummyStderr } = buildContext();

    const fakePluginService: PluginService = {
      search: async function* (_query: Readonly<SearchQuery>) {
        yield descriptor;
      },
      install: async () => {},
      uninstall: async () => {},
      listInstalled: async function* () {},
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await command.execute(context, { pluginId: descriptor.pluginId });

    expectStringEquals(
      dummyStderr.getString(),
      "ℹ Searching for plugin: @scope/plugin\nℹ Installing @scope/plugin...\n",
    );
  });

  test("strips the version from the specifier before searching, and passes it to install", async () => {
    const { context, dummyStderr } = buildContext();

    const searchQueries: Readonly<SearchQuery>[] = [];
    let installedDescriptor: VersionedPluginDescriptor | undefined;
    const fakePluginService: PluginService = {
      search: async function* (query: Readonly<SearchQuery>) {
        searchQueries.push(query);
        yield descriptor;
      },
      install: async (d: Readonly<VersionedPluginDescriptor>) => {
        installedDescriptor = d as VersionedPluginDescriptor;
      },
      uninstall: async () => {},
      listInstalled: async function* () {},
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await command.execute(context, { pluginId: `${descriptor.pluginId}:3.0.0` });

    expect(searchQueries).toEqual([{ text: descriptor.pluginId }]);
    expect(installedDescriptor?.version).toEqual("3.0.0");
    expectStringEquals(
      dummyStderr.getString(),
      "ℹ Searching for plugin: @scope/plugin\nℹ Installing @scope/plugin...\n",
    );
  });

  test("passes a non-semver version tag (e.g. latest) through to install unchanged", async () => {
    const { context } = buildContext();

    let installedDescriptor: VersionedPluginDescriptor | undefined;
    const fakePluginService: PluginService = {
      search: async function* (_query: Readonly<SearchQuery>) {
        yield descriptor;
      },
      install: async (d: Readonly<VersionedPluginDescriptor>) => {
        installedDescriptor = d as VersionedPluginDescriptor;
      },
      uninstall: async () => {},
      listInstalled: async function* () {},
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await command.execute(context, { pluginId: `${descriptor.pluginId}:latest` });

    expect(installedDescriptor?.version).toEqual("latest");
  });

  test("falls back to direct install with parsed version when search finds no match", async () => {
    const { context } = buildContext();

    const searchQueries: Readonly<SearchQuery>[] = [];
    let installedDescriptor: VersionedPluginDescriptor | undefined;
    const fakePluginService: PluginService = {
      search: async function* (query: Readonly<SearchQuery>) {
        searchQueries.push(query);
        yield* [];
      },
      install: async (d: Readonly<VersionedPluginDescriptor>) => {
        installedDescriptor = d as VersionedPluginDescriptor;
      },
      uninstall: async () => {},
      listInstalled: async function* () {},
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginAddSubCommand();
    await command.execute(context, { pluginId: "@other/plugin:2.5.0" });

    expect(searchQueries).toEqual([{ text: "@other/plugin" }]);
    expect(installedDescriptor?.pluginId).toEqual("@other/plugin");
    expect(installedDescriptor?.version).toEqual("2.5.0");
  });
});
