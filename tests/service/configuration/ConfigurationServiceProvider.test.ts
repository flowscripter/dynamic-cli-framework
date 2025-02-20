import { assertEquals, assertThrows } from "@std/assert";
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

Deno.test("ConfigurationServiceProvider provide works", async () => {
  const configurationServiceProvider = new ConfigurationServiceProvider(
    100,
    false,
    true,
  );
  const serviceInfo = await configurationServiceProvider.provide(
    getCLIConfig(),
  );
  assertEquals(serviceInfo.commands.length, 2);
});

Deno.test("ConfigurationServiceProvider initService with no config works", async () => {
  const configurationServiceProvider = new ConfigurationServiceProvider(
    100,
  );

  const context = new DefaultContext(getCLIConfig());

  await configurationServiceProvider.initService(context);

  assertEquals(configurationServiceProvider.getConfigString(), "{}");
});

Deno.test("ConfigurationServiceProvider initService with config works", async () => {
  const configurationServiceProvider = new ConfigurationServiceProvider(
    100,
    false,
    true,
  );

  const context = new DefaultContext(getCLIConfig());

  const configLocation = await Deno.makeTempFile();
  configurationServiceProvider.setConfigLocation(configLocation);

  const config = getConfig();

  await Deno.writeTextFile(configLocation, JSON.stringify(config));

  await configurationServiceProvider.initService(context);

  assertEquals(
    configurationServiceProvider.getConfigString(),
    JSON.stringify(config, null, 2),
  );
});

Deno.test("getDefaultArgumentValues works with config", async () => {
  const configurationServiceProvider = new ConfigurationServiceProvider(
    100,
    false,
    true,
  );

  const context = new DefaultContext(getCLIConfig());

  const configLocation = await Deno.makeTempFile();
  configurationServiceProvider.setConfigLocation(configLocation);

  const config = getConfig();

  await Deno.writeTextFile(configLocation, JSON.stringify(config));

  const subCommand = getSubCommand();

  await configurationServiceProvider.initService(context);

  assertEquals(
    configurationServiceProvider.getDefaultArgumentValues(
      getCLIConfig(),
      subCommand,
    ),
    config.defaults.command2,
  );
});

Deno.test("getDefaultArgumentValues works with env vars", async () => {
  try {
    const configurationServiceProvider = new ConfigurationServiceProvider(
      100,
      true,
      true,
    );

    const context = new DefaultContext(getCLIConfig());

    Deno.env.set("FOO_COMMAND2_ARG4", "true");

    const subCommand = getSubCommand();

    await configurationServiceProvider.initService(context);

    assertEquals(
      configurationServiceProvider.getDefaultArgumentValues(
        getCLIConfig(),
        subCommand,
      ),
      { arg4: "true" },
    );
  } finally {
    Deno.env.delete("FOO_COMMAND2_ARG4");
  }
});

Deno.test("setCommandKeyValueScope works", async () => {
  const configurationServiceProvider = new ConfigurationServiceProvider(
    100,
    false,
    true,
    true,
  );
  const cliConfig = getCLIConfig();
  const context = new DefaultContext(cliConfig);

  const configLocation = await Deno.makeTempFile();
  configurationServiceProvider.setConfigLocation(configLocation);

  const config = getConfig();

  await Deno.writeTextFile(configLocation, JSON.stringify(config));

  const serviceInfo = await configurationServiceProvider.provide(cliConfig);

  await configurationServiceProvider.initService(context);

  const keyValueService = serviceInfo.service! as KeyValueService;

  configurationServiceProvider.setCommandKeyValueScope("command2");

  assertEquals(keyValueService.hasKey("foo2"), false);

  await configurationServiceProvider.clearKeyValueScope();
  configurationServiceProvider.setCommandKeyValueScope("command1");

  assertEquals(keyValueService.getKey("foo2"), "bar2");

  await configurationServiceProvider.clearKeyValueScope();

  assertThrows(() => keyValueService.hasKey("foo2"));
});

Deno.test("setServiceKeyValueScope works", async () => {
  const configurationServiceProvider = new ConfigurationServiceProvider(
    100,
    false,
    true,
    true,
  );
  const cliConfig = getCLIConfig();
  const context = new DefaultContext(cliConfig);

  const configLocation = await Deno.makeTempFile();
  configurationServiceProvider.setConfigLocation(configLocation);

  const config = getConfig();

  await Deno.writeTextFile(configLocation, JSON.stringify(config));

  const serviceInfo = await configurationServiceProvider.provide(cliConfig);

  await configurationServiceProvider.initService(context);

  const keyValueService = serviceInfo.service! as KeyValueService;

  configurationServiceProvider.setServiceKeyValueScope("service-id-2");

  assertEquals(keyValueService.hasKey("foo1"), false);

  await configurationServiceProvider.clearKeyValueScope();
  configurationServiceProvider.setServiceKeyValueScope("service-id-1");

  assertEquals(keyValueService.getKey("foo1"), "bar");

  await configurationServiceProvider.clearKeyValueScope();

  assertThrows(() => keyValueService.hasKey("foo1"));
});
