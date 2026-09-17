import process from "node:process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import ConfigurationServiceProvider from "../../../src/service/configuration/ConfigurationServiceProvider.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import { ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";

function getConfig() {
  return {
    defaults: {
      command1: {
        arg1: [1, 2],
        arg2: {
          arg3: "foo",
        },
      },
      command2: {
        arg4: true,
      },
    },
    "key-values": {
      commands: {
        command1: {
          foo1: "bar1",
          foo2: "bar2",
        },
        command2: {
          foo1: "bar3",
        },
      },
      services: {
        "service-id-1": {
          foo1: "bar",
        },
        "service-id-2": {
          foo2: "bar2",
        },
      },
    },
  };
}

function getSubCommand(): SubCommand {
  return {
    name: "command2",
    enableConfiguration: true,
    options: [
      {
        name: "arg4",
        type: ValueTypeName.BOOLEAN,
      },
    ],
    positionals: [],
    execute: async (): Promise<void> => {},
  };
}
describe("ConfigurationServiceProvider tests", () => {
  test("ConfigurationServiceProvider getServiceInfo works", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(100, false, true);
    const serviceInfo = await configurationServiceProvider.getServiceInfo(getCLIConfig());
    expect(serviceInfo.commands.length).toEqual(2);
  });

  test("ConfigurationServiceProvider initService with no config works", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(100);

    const context = new DefaultContext(getCLIConfig());

    await configurationServiceProvider.initService(context);

    expect(configurationServiceProvider.getConfigString()).toEqual("{}");
  });

  test("ConfigurationServiceProvider initService with config works", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(100, false, true);

    const context = new DefaultContext(getCLIConfig());

    const configFolder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
    const configLocation = path.join(configFolder, "config.json");
    configurationServiceProvider.setConfigLocation(configLocation);

    const config = getConfig();

    await fs.writeFile(configLocation, JSON.stringify(config));

    await configurationServiceProvider.initService(context);

    expect(configurationServiceProvider.getConfigString()).toEqual(JSON.stringify(config, null, 2));
  });

  test("ConfigurationServiceProvider initService with missing explicit config location throws", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(100, false, true);

    const context = new DefaultContext(getCLIConfig());

    configurationServiceProvider.setConfigLocation("/nonexistent/path/config.json");

    await expect(configurationServiceProvider.initService(context)).rejects.toThrow(
      "doesn't exist or not visible",
    );
  });

  test("getDefaultArgumentValues works with config", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(100, false, true);

    const context = new DefaultContext(getCLIConfig());

    const configFolder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
    const configLocation = path.join(configFolder, "config.json");
    configurationServiceProvider.setConfigLocation(configLocation);

    const config = getConfig();

    await fs.writeFile(configLocation, JSON.stringify(config));

    const subCommand = getSubCommand();

    await configurationServiceProvider.initService(context);
    await configurationServiceProvider.getServiceInfo(getCLIConfig());

    expect(
      await configurationServiceProvider.getDefaultArgumentValues(getCLIConfig(), subCommand),
    ).toEqual(config.defaults.command2);
  });

  test("getDefaultArgumentValues works with env vars", async () => {
    try {
      const configurationServiceProvider = new ConfigurationServiceProvider(100, true, true);

      const context = new DefaultContext(getCLIConfig());

      process.env["FOO_COMMAND2_ARG4"] = "true";

      const subCommand = getSubCommand();

      await configurationServiceProvider.initService(context);
      await configurationServiceProvider.getServiceInfo(getCLIConfig());

      expect(
        await configurationServiceProvider.getDefaultArgumentValues(getCLIConfig(), subCommand),
      ).toEqual({ arg4: "true" });
    } finally {
      delete process.env["FOO_COMMAND2_ARG4"];
    }
  });

  test("secretServiceEnabled requires configEnabled", () => {
    expect(() => new ConfigurationServiceProvider(100, false, false, true)).toThrow(
      "configEnabled must be true",
    );
  });
});
