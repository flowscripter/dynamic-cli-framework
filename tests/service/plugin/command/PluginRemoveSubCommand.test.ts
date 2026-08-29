import { describe, expect, test } from "bun:test";
import type { VersionedPluginDescriptor } from "@flowscripter/dynamic-plugin-framework";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import { PluginRemoveSubCommand } from "../../../../src/service/plugin/command/PluginRemoveSubCommand.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { PLUGIN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { PluginService } from "@flowscripter/dynamic-cli-framework-api";

function buildContext(): {
  context: DefaultContext;
  messages: { print: string[]; spinner: string[]; spinnerHidden: number };
} {
  const context = new DefaultContext(getCLIConfig());
  const messages = { print: [] as string[], spinner: [] as string[], spinnerHidden: 0 };
  context.addServiceInstance(PRINTER_SERVICE_ID, {
    print: (msg: string) => {
      messages.print.push(msg);
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

describe("PluginRemoveSubCommand", () => {
  test("shows a spinner while removing and prints the removal message", async () => {
    const { context, messages } = buildContext();

    const fakePluginService: PluginService = {
      search: async function* () {},
      checkAvailable: async () => true,
      install: async () => {},
      uninstall: async () => {},
      listInstalled: async function* () {},
      checkForUpdates: async function* () {},
    };
    context.addServiceInstance(PLUGIN_SERVICE_ID, fakePluginService);

    const command = new PluginRemoveSubCommand();
    await command.execute(context, { pluginId: descriptor.pluginId });

    expect(messages.spinner).toEqual(["Removing plugin: @scope/plugin..."]);
    expect(messages.spinnerHidden).toEqual(1);
    expect(messages.print).toEqual(["Plugin @scope/plugin removed.\n"]);
  });
});
