import process from "node:process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import ConfigurationServiceProvider from "../../../src/service/configuration/ConfigurationServiceProvider.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import { ArgumentValueTypeName } from "../../../src/api/argument/ArgumentValueTypes.ts";
import type KeyValueService from "../../../src/api/service/core/KeyValueService.ts";
import type SubCommand from "../../../src/api/command/SubCommand.ts";

function getConfig() {
  return {
    defaults: {
      command1: {
        arg1: [
          1,
          2,
        ],
        arg2: {
          "arg3": "foo",
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
    options: [{
      name: "arg4",
      type: ArgumentValueTypeName.BOOLEAN,
    }],
    positionals: [],
    execute: async (): Promise<void> => {},
  };
}
describe("ConfigurationServiceProvider Tests", () => {
  test("ConfigurationServiceProvider provide works", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(
      100,
      false,
      true,
    );
    const serviceInfo = await configurationServiceProvider.provide(
      getCLIConfig(),
    );
    expect(serviceInfo.commands.length).toEqual(2);
  });

  test("ConfigurationServiceProvider initService with no config works", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(
      100,
    );

    const context = new DefaultContext(getCLIConfig());

    await configurationServiceProvider.initService(context);

    expect(configurationServiceProvider.getConfigString()).toEqual("{}");
  });

  test("ConfigurationServiceProvider initService with config works", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(
      100,
      false,
      true,
    );

    const context = new DefaultContext(getCLIConfig());

    const configFolder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
    const configLocation = path.join(configFolder, "config.json");
    configurationServiceProvider.setConfigLocation(configLocation);

    const config = getConfig();

    await fs.writeFile(configLocation, JSON.stringify(config));

    await configurationServiceProvider.initService(context);

    expect(
      configurationServiceProvider.getConfigString(),
    ).toEqual(
      JSON.stringify(config, null, 2),
    );
  });

  test("getDefaultArgumentValues works with config", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(
      100,
      false,
      true,
    );

    const context = new DefaultContext(getCLIConfig());

    const configFolder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
    const configLocation = path.join(configFolder, "config.json");
    configurationServiceProvider.setConfigLocation(configLocation);

    const config = getConfig();

    await fs.writeFile(configLocation, JSON.stringify(config));

    const subCommand = getSubCommand();

    await configurationServiceProvider.initService(context);

    expect(
      configurationServiceProvider.getDefaultArgumentValues(
        getCLIConfig(),
        subCommand,
      ),
    ).toEqual(
      config.defaults.command2,
    );
  });

  test("getDefaultArgumentValues works with env vars", async () => {
    try {
      const configurationServiceProvider = new ConfigurationServiceProvider(
        100,
        true,
        true,
      );

      const context = new DefaultContext(getCLIConfig());

      process.env["FOO_COMMAND2_ARG4"] = "true";

      const subCommand = getSubCommand();

      await configurationServiceProvider.initService(context);

      expect(
        configurationServiceProvider.getDefaultArgumentValues(
          getCLIConfig(),
          subCommand,
        ),
      ).toEqual(
        { arg4: "true" },
      );
    } finally {
      delete process.env["FOO_COMMAND2_ARG4"];
    }
  });

  test("setCommandKeyValueScope works", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(
      100,
      false,
      true,
      true,
    );
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);

    const configFolder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
    const configLocation = path.join(configFolder, "config.json");
    configurationServiceProvider.setConfigLocation(configLocation);

    const config = getConfig();

    await fs.writeFile(configLocation, JSON.stringify(config));

    const serviceInfo = await configurationServiceProvider.provide(cliConfig);

    await configurationServiceProvider.initService(context);

    const keyValueService = serviceInfo.service! as KeyValueService;

    configurationServiceProvider.setCommandKeyValueScope("command2");

    expect(keyValueService.hasKey("foo2")).toBeFalse();

    await configurationServiceProvider.clearKeyValueScope();
    configurationServiceProvider.setCommandKeyValueScope("command1");

    expect(keyValueService.getKey("foo2")).toEqual("bar2");

    await configurationServiceProvider.clearKeyValueScope();

    expect(() => keyValueService.hasKey("foo2")).toThrow();
  });

  test("setServiceKeyValueScope works", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(
      100,
      false,
      true,
      true,
    );
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);

    const configFolder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
    const configLocation = path.join(configFolder, "config.json");
    configurationServiceProvider.setConfigLocation(configLocation);

    const config = getConfig();

    await fs.writeFile(configLocation, JSON.stringify(config));

    const serviceInfo = await configurationServiceProvider.provide(cliConfig);

    await configurationServiceProvider.initService(context);

    const keyValueService = serviceInfo.service! as KeyValueService;

    configurationServiceProvider.setServiceKeyValueScope("service-id-2");

    expect(keyValueService.hasKey("foo1")).toBeFalse();

    await configurationServiceProvider.clearKeyValueScope();
    configurationServiceProvider.setServiceKeyValueScope("service-id-1");

    expect(keyValueService.getKey("foo1")).toEqual("bar");

    await configurationServiceProvider.clearKeyValueScope();

    expect(() => keyValueService.hasKey("foo1")).toThrow();
  });
});
