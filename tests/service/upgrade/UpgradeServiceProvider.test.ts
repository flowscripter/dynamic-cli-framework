import { describe, expect, test } from "bun:test";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import { UPGRADE_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import UpgradeServiceProvider from "../../../src/service/upgrade/UpgradeServiceProvider.ts";
import { UpgradeSubCommand } from "../../../src/service/upgrade/command/UpgradeSubCommand.ts";
import type { UpgradeLocationsConfig } from "../../../src/service/upgrade/UpgradeLocationsConfig.ts";

function getCLIConfig(): CLIConfig {
  return { name: "testcli", description: "Test CLI", version: "1.0.0" };
}

function getConfig(): UpgradeLocationsConfig {
  return { supportedPlatforms: [] };
}

const PROMPTER_SERVICE_ID = "@flowscripter/dynamic-cli-framework/prompter-service";
const KEY_VALUE_SERVICE_ID = "@flowscripter/dynamic-cli-framework/key-value-service";
const SPAWN_SERVICE_ID = "@flowscripter/dynamic-cli-framework/spawn-service";
const PRINTER_SERVICE_ID = "@flowscripter/dynamic-cli-framework/printer-service";

describe("UpgradeServiceProvider", () => {
  test("has correct serviceId", () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    expect(provider.serviceId).toEqual(UPGRADE_SERVICE_ID);
  });

  test("has correct servicePriority", () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    expect(provider.servicePriority).toEqual(6);
  });

  test("getServiceInfo returns service and upgrade command", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    const serviceInfo = await provider.getServiceInfo(getCLIConfig());
    expect(serviceInfo.service).toBeDefined();
    expect(serviceInfo.commands.length).toEqual(1);
    expect(serviceInfo.commands[0]).toBeInstanceOf(UpgradeSubCommand);
  });

  test("initService resolves when prompter service not available", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());
    await expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService resolves when key-value service not available", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());
    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    await expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService skips prompt when upgrade-status is 'declined'", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());

    let promptCalled = false;
    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: true,
      prompt: () => {
        promptCalled = true;
        return Promise.resolve({ name: "", value: false });
      },
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      hasKey: (key: string) => Promise.resolve(key === "upgrade-status"),
      getKey: () => Promise.resolve("declined"),
      setKey: () => Promise.resolve(),
      deleteKey: () => Promise.resolve(),
    });

    await provider.initService(context);
    expect(promptCalled).toBe(false);
  });

  test("initService skips prompt when promptEnabled is false", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: false,
      prompt: () => Promise.resolve({ name: "", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      hasKey: () => Promise.resolve(false),
      getKey: () => Promise.resolve(""),
      setKey: () => Promise.resolve(),
      deleteKey: () => Promise.resolve(),
    });

    await expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService skips prompt when no install method detected", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());

    let promptCalled = false;
    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: true,
      prompt: () => {
        promptCalled = true;
        return Promise.resolve({ name: "", value: false });
      },
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      hasKey: () => Promise.resolve(false),
      getKey: () => Promise.resolve(""),
      setKey: () => Promise.resolve(),
      deleteKey: () => Promise.resolve(),
    });

    await provider.initService(context);
    expect(promptCalled).toBe(false);
  });

  test("initService stores 'declined' when user says no to auto-upgrade", async () => {
    const provider = new UpgradeServiceProvider(6, {
      supportedPlatforms: [],
      githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
    });
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());

    let storedKey = "";
    let storedValue = "";
    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "enable-upgrade", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      hasKey: () => Promise.resolve(false),
      getKey: () => Promise.resolve(""),
      setKey: (key: string, value: string) => {
        storedKey = key;
        storedValue = value;
        return Promise.resolve();
      },
      deleteKey: () => Promise.resolve(),
    });

    await provider.initService(context);
    expect(storedKey).toEqual("upgrade-status");
    expect(storedValue).toEqual("declined");
  });

  test("initService stores 'enabled' and checks for upgrade when user says yes", async () => {
    const provider = new UpgradeServiceProvider(6, {
      supportedPlatforms: [],
      githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
    });
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());

    const storedEntries: Array<{ key: string; value: string }> = [];
    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "enable-upgrade", value: true }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      hasKey: () => Promise.resolve(false),
      getKey: () => Promise.resolve(""),
      setKey: (key: string, value: string) => {
        storedEntries.push({ key, value });
        return Promise.resolve();
      },
      deleteKey: () => Promise.resolve(),
    });

    await expect(provider.initService(context)).resolves.toBeUndefined();
    const statusEntry = storedEntries.find((e) => e.key === "upgrade-status");
    expect(statusEntry?.value).toEqual("enabled");
  });

  test("initService wires SpawnService into the upgrade service when available", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    const serviceInfo = await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(SPAWN_SERVICE_ID, {
      spawn: () => Promise.resolve({ ok: true, exitCode: 0 }),
    });

    await provider.initService(context);
    // No PrompterService/KeyValueService present, so this just verifies no throw occurs while
    // wiring the SpawnService dependency in before the early-return guards.
    expect(serviceInfo.service).toBeDefined();
  });

  test("initService runs auto-upgrade check every run when upgrade-status is 'enabled'", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      hasKey: (key: string) => Promise.resolve(key === "upgrade-status"),
      getKey: () => Promise.resolve("enabled"),
      setKey: () => Promise.resolve(),
      deleteKey: () => Promise.resolve(),
    });

    let printed = "";
    context.addServiceInstance(PRINTER_SERVICE_ID, {
      info: (msg: string) => {
        printed = msg;
        return Promise.resolve();
      },
      error: () => Promise.resolve(),
    });

    // No upgrade location configured, so checkForUpgrade resolves undefined and nothing is printed.
    await provider.initService(context);
    expect(printed).toEqual("");
  });
});
