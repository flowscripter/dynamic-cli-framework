import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import ConfigurationServiceProvider from "../../../src/service/configuration/ConfigurationServiceProvider.ts";
import KeyValueServiceProvider from "../../../src/service/configuration/KeyValueServiceProvider.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import { KEY_VALUE_SERVICE_ID, SHUTDOWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { KeyValueService, ShutdownService } from "@flowscripter/dynamic-cli-framework-api";

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
    defaults: {},
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

async function getInitialisedProviders(config: unknown) {
  const configurationServiceProvider = new ConfigurationServiceProvider(100, false, true);
  const keyValueServiceProvider = new KeyValueServiceProvider(
    99,
    configurationServiceProvider,
    true,
  );
  const cliConfig = getCLIConfig();
  const context = new DefaultContext(cliConfig);
  context.addServiceInstance(SHUTDOWN_SERVICE_ID, getFakeShutdownService());

  const configFolder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
  const configLocation = path.join(configFolder, "config.json");
  configurationServiceProvider.setConfigLocation(configLocation);

  await fs.writeFile(configLocation, JSON.stringify(config));

  await configurationServiceProvider.getServiceInfo(cliConfig);
  await keyValueServiceProvider.getServiceInfo(cliConfig);
  await configurationServiceProvider.initService(context);
  await keyValueServiceProvider.initService(context);

  return { keyValueServiceProvider, context };
}

describe("KeyValueServiceProvider tests", () => {
  test("getScopedKeyValueService isolates command scopes", async () => {
    const { keyValueServiceProvider } = await getInitialisedProviders(getConfig());

    const command2KeyValueService = keyValueServiceProvider.getScopedKeyValueService(
      "command",
      "command2",
    );
    const command1KeyValueService = keyValueServiceProvider.getScopedKeyValueService(
      "command",
      "command1",
    );

    expect(await command2KeyValueService.has("foo2")).toBeFalse();
    expect(await command1KeyValueService.get("foo2")).toEqual("bar2");

    // requesting the same scope again returns the same, cached instance
    expect(keyValueServiceProvider.getScopedKeyValueService("command", "command1")).toBe(
      command1KeyValueService,
    );
  });

  test("getScopedKeyValueService isolates service scopes", async () => {
    const { keyValueServiceProvider } = await getInitialisedProviders(getConfig());

    const service2KeyValueService = keyValueServiceProvider.getScopedKeyValueService(
      "service",
      "service-id-2",
    );
    const service1KeyValueService = keyValueServiceProvider.getScopedKeyValueService(
      "service",
      "service-id-1",
    );

    expect(await service2KeyValueService.has("foo1")).toBeFalse();
    expect(await service1KeyValueService.get("foo1")).toEqual("bar");
  });

  test("getContextForScope isolates a KeyValueService write from a concurrently-open second scope", async () => {
    const { keyValueServiceProvider, context } = await getInitialisedProviders({});

    // simulates a task whose async work outlives the start of another task.
    // write is deliberately delayed via a manually-resolved promise, into a point in time after
    // scopeB's context has already been created and used.
    let resolveDelayedWrite: () => void = () => {};
    const delayedWrite = new Promise<void>((resolve) => {
      resolveDelayedWrite = resolve;
    });

    const scopedContextA = keyValueServiceProvider.getContextForScope(context, "service", "scope-a");
    const scopedContextB = keyValueServiceProvider.getContextForScope(context, "service", "scope-b");

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

  test("keyValueServiceEnabled requires configEnabled", () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(100, false, false);
    expect(
      () => new KeyValueServiceProvider(99, configurationServiceProvider, true, false),
    ).toThrow("configEnabled must be true");
  });

  test("secretServiceEnabled requires configEnabled", () => {
    const configurationServiceProvider = new ConfigurationServiceProvider(100, false, false);
    expect(
      () => new KeyValueServiceProvider(99, configurationServiceProvider, false, true),
    ).toThrow("configEnabled must be true");
  });
});
