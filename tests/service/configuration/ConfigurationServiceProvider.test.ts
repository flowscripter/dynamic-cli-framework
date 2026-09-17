import process from "node:process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import ConfigurationServiceProvider from "../../../src/service/configuration/ConfigurationServiceProvider.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import {
  KEY_VALUE_SERVICE_ID,
  SHUTDOWN_SERVICE_ID,
  ValueTypeName,
} from "@flowscripter/dynamic-cli-framework-api";
import type { KeyValueService, ShutdownService } from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";

function getFakeShutdownService(): ShutdownService {
  return {
    registerTask: () => {},
    enterLongRunningMode: () => {},
    leaveLongRunningMode: () => {},
    isShutdownRequested: false,
  };
}

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

  test("getScopedKeyValueService isolates command scopes", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(100, false, true, true);
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);
    context.addServiceInstance(SHUTDOWN_SERVICE_ID, getFakeShutdownService());

    const configFolder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
    const configLocation = path.join(configFolder, "config.json");
    configurationServiceProvider.setConfigLocation(configLocation);

    const config = getConfig();

    await fs.writeFile(configLocation, JSON.stringify(config));

    await configurationServiceProvider.getServiceInfo(cliConfig);
    await configurationServiceProvider.initService(context);

    const command2KeyValueService = configurationServiceProvider.getScopedKeyValueService(
      "command",
      "command2",
    );
    const command1KeyValueService = configurationServiceProvider.getScopedKeyValueService(
      "command",
      "command1",
    );

    expect(await command2KeyValueService.has("foo2")).toBeFalse();
    expect(await command1KeyValueService.get("foo2")).toEqual("bar2");

    // requesting the same scope again returns the same, cached instance
    expect(configurationServiceProvider.getScopedKeyValueService("command", "command1")).toBe(
      command1KeyValueService,
    );
  });

  test("getScopedKeyValueService isolates service scopes", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(100, false, true, true);
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);
    context.addServiceInstance(SHUTDOWN_SERVICE_ID, getFakeShutdownService());

    const configFolder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
    const configLocation = path.join(configFolder, "config.json");
    configurationServiceProvider.setConfigLocation(configLocation);

    const config = getConfig();

    await fs.writeFile(configLocation, JSON.stringify(config));

    await configurationServiceProvider.getServiceInfo(cliConfig);
    await configurationServiceProvider.initService(context);

    const service2KeyValueService = configurationServiceProvider.getScopedKeyValueService(
      "service",
      "service-id-2",
    );
    const service1KeyValueService = configurationServiceProvider.getScopedKeyValueService(
      "service",
      "service-id-1",
    );

    expect(await service2KeyValueService.has("foo1")).toBeFalse();
    expect(await service1KeyValueService.get("foo1")).toEqual("bar");
  });

  test("getContextForScope isolates a KeyValueService write from a concurrently-open second scope", async () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(100, false, true, true);
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);
    context.addServiceInstance(SHUTDOWN_SERVICE_ID, getFakeShutdownService());

    const configFolder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
    const configLocation = path.join(configFolder, "config.json");
    configurationServiceProvider.setConfigLocation(configLocation);
    await fs.writeFile(configLocation, "{}");

    await configurationServiceProvider.getServiceInfo(cliConfig);
    await configurationServiceProvider.initService(context);

    // simulates a task whose async work outlives its own "window" (see issue #172): scopeA's
    // write is deliberately delayed via a manually-resolved promise, into a point in time after
    // scopeB's context has already been created and used.
    let resolveDelayedWrite: () => void = () => {};
    const delayedWrite = new Promise<void>((resolve) => {
      resolveDelayedWrite = resolve;
    });

    const scopedContextA = configurationServiceProvider.getContextForScope(
      context,
      "service",
      "scope-a",
    );
    const scopedContextB = configurationServiceProvider.getContextForScope(
      context,
      "service",
      "scope-b",
    );

    const kvA = scopedContextA.getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService;
    const kvB = scopedContextB.getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService;

    const deferredWrite = delayedWrite.then(() => kvA.set("shared-key", "scope-a-value"));

    // scopeB writes and reads its own data while scopeA's write is still pending
    await kvB.set("shared-key", "scope-b-value");
    expect(await kvB.get("shared-key")).toEqual("scope-b-value");

    // now let scopeA's delayed write proceed
    resolveDelayedWrite();
    await deferredWrite;

    // scopeA's delayed write must never have landed in scopeB's data, regardless of timing
    expect(await kvB.get("shared-key")).toEqual("scope-b-value");
    expect(await kvA.get("shared-key")).toEqual("scope-a-value");
  });

  test("secretServiceEnabled requires configEnabled", () => {
    expect(() => new ConfigurationServiceProvider(100, false, false, false, true)).toThrow(
      "configEnabled must be true",
    );
  });
});
