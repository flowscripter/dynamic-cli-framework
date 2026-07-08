import { describe, test } from "bun:test";
import type {
  SearchQuery,
  VersionedPluginDescriptor,
} from "@flowscripter/dynamic-plugin-framework";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import { PluginAddSubCommand } from "../../../../src/service/plugin/command/PluginAddSubCommand.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import { PRINTER_SERVICE_ID } from "../../../../src/api/service/core/PrinterService.ts";
import { PLUGIN_SERVICE_ID } from "../../../../src/api/service/core/PluginService.ts";
import type PluginService from "../../../../src/api/service/core/PluginService.ts";
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
});
