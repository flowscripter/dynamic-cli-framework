import { describe, expect, test } from "bun:test";
import type {
  CLIConfig,
  Context,
  UpgradeCheckResult,
} from "@flowscripter/dynamic-cli-framework-api";
import {
  InstallMethod,
  RunState,
  SupportedArch,
  SupportedOs,
  UPGRADE_SERVICE_ID,
} from "@flowscripter/dynamic-cli-framework-api";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import UpgradeServiceProvider, {
  createAutoUpgradeStartupTask,
  createUpgradeCheckStartupTask,
} from "../../../src/service/upgrade/UpgradeServiceProvider.ts";
import { UpgradeSubCommand } from "../../../src/service/upgrade/command/UpgradeSubCommand.ts";
import type { UpgradeLocationsConfig } from "../../../src/service/upgrade/UpgradeLocationsConfig.ts";

function getCLIConfig(): CLIConfig {
  return { name: "testcli", description: "Test CLI", version: "1.0.0" };
}

function getConfig(): UpgradeLocationsConfig {
  return { supportedPlatforms: [] };
}

function addPrinterService(context: DefaultContext): void {
  context.addServiceInstance(PRINTER_SERVICE_ID, {
    info: () => Promise.resolve(),
    error: () => Promise.resolve(),
  });
}

const PROMPTER_SERVICE_ID = "@flowscripter/dynamic-cli-framework/prompter-service";
const KEY_VALUE_SERVICE_ID = "@flowscripter/dynamic-cli-framework/key-value-service";
const SPAWN_SERVICE_ID = "@flowscripter/dynamic-cli-framework/spawn-service";
const PRINTER_SERVICE_ID = "@flowscripter/dynamic-cli-framework/printer-service";

/**
 * Run the provider's init with `context` (whose KeyValueService stands in for the upgrade
 * service's scope), then run the auto-upgrade task with a task context whose KeyValueService
 * stands in for the task's own scope. Returns the keys written to the task-scoped store.
 */
async function initAndRunAutoUpgrade(
  provider: UpgradeServiceProvider,
  context: DefaultContext,
): Promise<Array<string>> {
  const taskScopeKeys: Array<string> = [];
  const taskKeyValueService = {
    has: () => Promise.resolve(false),
    get: () => Promise.resolve(""),
    set: (key: string) => {
      taskScopeKeys.push(key);
      return Promise.resolve();
    },
    delete: () => Promise.resolve(),
    flush: () => Promise.resolve(),
  };
  const taskContext: Context = {
    cliConfig: context.cliConfig,
    getServiceById: (id: string) =>
      id === KEY_VALUE_SERVICE_ID ? taskKeyValueService : context.getServiceById(id),
    doesServiceExist: (id: string) => context.doesServiceExist(id),
  };
  await provider.initService(context);
  await createAutoUpgradeStartupTask(provider, 10).run(taskContext);
  return taskScopeKeys;
}

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

  test("auto-upgrade task resolves when prompter service not available", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());
    addPrinterService(context);
    expect(await initAndRunAutoUpgrade(provider, context)).toEqual([]);
  });

  test("auto-upgrade task resolves when key-value service not available", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());
    addPrinterService(context);
    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    expect(await initAndRunAutoUpgrade(provider, context)).toEqual([]);
  });

  test("auto-upgrade task skips prompt when upgrade-status is 'declined'", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());
    addPrinterService(context);

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
      has: (key: string) => Promise.resolve(key === "upgrade-status"),
      get: () => Promise.resolve("declined"),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      flush: () => Promise.resolve(),
    });

    expect(await initAndRunAutoUpgrade(provider, context)).toEqual([]);
    expect(promptCalled).toBe(false);
  });

  test("auto-upgrade task skips prompt when promptEnabled is false", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());
    addPrinterService(context);

    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: false,
      prompt: () => Promise.resolve({ name: "", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      has: () => Promise.resolve(false),
      get: () => Promise.resolve(""),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      flush: () => Promise.resolve(),
    });

    expect(await initAndRunAutoUpgrade(provider, context)).toEqual([]);
  });

  test("auto-upgrade task skips prompt when no install method detected", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());
    addPrinterService(context);

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
      has: () => Promise.resolve(false),
      get: () => Promise.resolve(""),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      flush: () => Promise.resolve(),
    });

    expect(await initAndRunAutoUpgrade(provider, context)).toEqual([]);
    expect(promptCalled).toBe(false);
  });

  test("auto-upgrade task stores 'declined' when user says no to auto-upgrade", async () => {
    const provider = new UpgradeServiceProvider(6, {
      supportedPlatforms: [],
      githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
    });
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());
    addPrinterService(context);

    let storedKey = "";
    let storedValue = "";
    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "enable-upgrade", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      has: () => Promise.resolve(false),
      get: () => Promise.resolve(""),
      set: (key: string, value: string) => {
        storedKey = key;
        storedValue = value;
        return Promise.resolve();
      },
      delete: () => Promise.resolve(),
      flush: () => Promise.resolve(),
    });

    expect(await initAndRunAutoUpgrade(provider, context)).toEqual([]);
    expect(storedKey).toEqual("upgrade-status");
    expect(storedValue).toEqual("declined");
  });

  test("auto-upgrade task stores 'enabled' and checks for upgrade when user says yes", async () => {
    const provider = new UpgradeServiceProvider(6, {
      supportedPlatforms: [],
      githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
    });
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());
    addPrinterService(context);

    const storedEntries: Array<{ key: string; value: string }> = [];
    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "enable-upgrade", value: true }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      has: () => Promise.resolve(false),
      get: () => Promise.resolve(""),
      set: (key: string, value: string) => {
        storedEntries.push({ key, value });
        return Promise.resolve();
      },
      delete: () => Promise.resolve(),
      flush: () => Promise.resolve(),
    });

    expect(await initAndRunAutoUpgrade(provider, context)).toEqual([]);
    const statusEntry = storedEntries.find((e) => e.key === "upgrade-status");
    expect(statusEntry?.value).toEqual("enabled");
  });

  test("initService wires SpawnService into the upgrade service when available", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    const serviceInfo = await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());
    addPrinterService(context);

    context.addServiceInstance(SPAWN_SERVICE_ID, {
      spawn: () => Promise.resolve({ ok: true, exitCode: 0 }),
    });

    await provider.initService(context);
    // No PrompterService/KeyValueService present, so this just verifies no throw occurs while
    // wiring the SpawnService dependency in before the early-return guards.
    expect(serviceInfo.service).toBeDefined();
  });

  test("auto-upgrade task runs auto-upgrade check every run when upgrade-status is 'enabled'", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      has: (key: string) => Promise.resolve(key === "upgrade-status"),
      get: () => Promise.resolve("enabled"),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      flush: () => Promise.resolve(),
    });

    let printed = "";
    context.addServiceInstance(PRINTER_SERVICE_ID, {
      info: (msg: string) => {
        printed = msg;
        return Promise.resolve();
      },
      error: () => Promise.resolve(),
    });

    // No upgrade location configured, so checkForUpgrade resolves "unsupported" and nothing is printed.
    expect(await initAndRunAutoUpgrade(provider, context)).toEqual([]);
    expect(printed).toEqual("");
  });

  test("createAutoUpgradeStartupTask builds a blocking task with the given priority", async () => {
    const provider = new UpgradeServiceProvider(56, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const task = createAutoUpgradeStartupTask(provider, 10);
    expect(task.id).toEqual(`${UPGRADE_SERVICE_ID}-auto-upgrade`);
    expect(task.priority).toEqual(10);
    expect(task.mode).toEqual("blocking");
  });

  test("auto-upgrade task prints the upgraded message after a successful upgrade", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const upgradeService = provider.upgradeService!;
    upgradeService.getUpgradeCheckResult = () =>
      Promise.resolve({
        status: "checked",
        currentVersion: "1.0.0",
        latestVersion: "1.0.1",
        updateAvailable: true,
        os: SupportedOs.LINUX,
        arch: SupportedArch.X64,
        installMethod: InstallMethod.GITHUB_RELEASE,
      });
    let upgradeCalled = false;
    upgradeService.upgrade = () => {
      upgradeCalled = true;
      return Promise.resolve({ ok: true, oldVersion: "1.0.0", newVersion: "1.0.1" });
    };

    const context = new DefaultContext(getCLIConfig());
    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      has: (key: string) => Promise.resolve(key === "upgrade-status"),
      get: () => Promise.resolve("enabled"),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      flush: () => Promise.resolve(),
    });
    let printed = "";
    context.addServiceInstance(PRINTER_SERVICE_ID, {
      info: (msg: string) => {
        printed = msg;
        return Promise.resolve();
      },
      error: () => Promise.resolve(),
    });

    expect(await initAndRunAutoUpgrade(provider, context)).toEqual([]);
    expect(upgradeCalled).toBe(true);
    expect(printed).toEqual("testcli upgraded (1.0.0 -> 1.0.1)\n");
  });

  test("background check task and auto-upgrade task share one upgrade check", async () => {
    const provider = new UpgradeServiceProvider(6, getConfig());
    await provider.getServiceInfo(getCLIConfig());
    const upgradeService = provider.upgradeService!;
    let checkCount = 0;
    upgradeService.checkForUpgrade = () => {
      checkCount++;
      return Promise.resolve<UpgradeCheckResult>({ status: "unsupported" });
    };

    const context = new DefaultContext(getCLIConfig());
    addPrinterService(context);
    context.addServiceInstance(PROMPTER_SERVICE_ID, {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      has: (key: string) => Promise.resolve(key === "upgrade-status"),
      get: () => Promise.resolve("enabled"),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      flush: () => Promise.resolve(),
    });

    await provider.initService(context);
    await createUpgradeCheckStartupTask(upgradeService, 56).run(context);
    await createAutoUpgradeStartupTask(provider, 10).run(context);
    expect(checkCount).toEqual(1);
  });

  describe("restart after a successful automatic upgrade", () => {
    interface RestartScenario {
      restartAfterAutoUpgrade?: boolean;
      installMethod?: InstallMethod;
      upgradeOk?: boolean;
      resolvedExecutable?: string;
      restartRunState?: RunState;
      restartedFromVersion?: string;
      upgradeStatus?: string;
    }

    async function runScenario(scenario: RestartScenario) {
      const installMethod = scenario.installMethod ?? InstallMethod.GITHUB_RELEASE;
      const provider = new UpgradeServiceProvider(
        6,
        getConfig(),
        scenario.restartAfterAutoUpgrade ?? true,
      );
      provider.setRestartArgs(["sub", "--opt", "value"]);
      await provider.getServiceInfo(getCLIConfig());
      const upgradeService = provider.upgradeService!;
      Object.defineProperty(upgradeService, "restartedFromVersion", {
        value: scenario.restartedFromVersion,
      });

      const events: Array<string> = [];
      upgradeService.getUpgradeCheckResult = () =>
        Promise.resolve({
          status: "checked",
          currentVersion: "1.0.0",
          latestVersion: "1.0.1",
          updateAvailable: true,
          os: SupportedOs.LINUX,
          arch: SupportedArch.X64,
          installMethod,
        });
      upgradeService.upgrade = () => {
        events.push("upgrade");
        return Promise.resolve(
          scenario.upgradeOk === false
            ? { ok: false, oldVersion: "1.0.0", error: new Error("boom") }
            : { ok: true, oldVersion: "1.0.0", newVersion: "1.0.1" },
        );
      };
      upgradeService.refreshUpgradeCheckCache = () => {
        events.push("refresh-check-cache");
        return upgradeService.getUpgradeCheckResult();
      };
      upgradeService.resolveUpgradedExecutable = (method) => {
        events.push(`resolve:${method}`);
        return method === InstallMethod.WINGET
          ? undefined
          : (scenario.resolvedExecutable ?? "/usr/local/bin/testcli");
      };
      upgradeService.restart = (executable, args) => {
        events.push(`restart:${executable} ${args.join(" ")}`);
        return Promise.resolve(scenario.restartRunState);
      };

      const context = new DefaultContext(getCLIConfig());
      context.addServiceInstance(PROMPTER_SERVICE_ID, {
        promptEnabled: true,
        prompt: () => {
          events.push("prompt");
          return Promise.resolve({ name: "enable-upgrade", value: true });
        },
        promptAll: () => Promise.resolve([]),
      });
      const upgradeStatus = scenario.upgradeStatus ?? "enabled";
      context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
        has: (key: string) => Promise.resolve(key === "upgrade-status"),
        get: () => Promise.resolve(upgradeStatus),
        set: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        flush: () => {
          events.push("flush");
          return Promise.resolve();
        },
      });
      const printed: Array<string> = [];
      const record = (msg: string) => {
        printed.push(msg);
        return Promise.resolve();
      };
      context.addServiceInstance(PRINTER_SERVICE_ID, { info: record, warn: record, error: record });

      await provider.initService(context);
      const outcome = await createAutoUpgradeStartupTask(provider, 10).run(context);
      return { outcome, events, printed };
    }

    test("persists the upgrade check cache and flushes key-value data, then restarts with the CLI args and requests exit with the child's run state", async () => {
      const { outcome, events, printed } = await runScenario({
        restartRunState: RunState.NO_COMMAND,
      });

      expect(events).toEqual([
        "upgrade",
        `resolve:${InstallMethod.GITHUB_RELEASE}`,
        "refresh-check-cache",
        "flush",
        "restart:/usr/local/bin/testcli sub --opt value",
      ]);
      expect(outcome).toEqual({ exitRequest: { runState: RunState.NO_COMMAND } });
      expect(printed).toEqual(["testcli upgraded (1.0.0 -> 1.0.1)\n"]);
    });

    test("prints a restart hint and continues when the upgraded executable cannot be started", async () => {
      const { outcome, events, printed } = await runScenario({ restartRunState: undefined });

      expect(events).toContain("restart:/usr/local/bin/testcli sub --opt value");
      expect(outcome).toBeUndefined();
      expect(printed).toEqual([
        "testcli upgraded (1.0.0 -> 1.0.1)\n",
        "testcli upgraded to 1.0.1; restart it to use the new version\n",
      ]);
    });

    test("prints a restart hint for winget, which has no executable to restart", async () => {
      const { outcome, events, printed } = await runScenario({
        installMethod: InstallMethod.WINGET,
        restartRunState: RunState.SUCCESS,
      });

      expect(events).toEqual(["upgrade", `resolve:${InstallMethod.WINGET}`]);
      expect(outcome).toBeUndefined();
      expect(printed).toEqual([
        "testcli upgraded (1.0.0 -> 1.0.1)\n",
        "Restart testcli to use 1.0.1\n",
      ]);
    });

    test("does not restart when restarting is disabled", async () => {
      const { outcome, events } = await runScenario({
        restartAfterAutoUpgrade: false,
        restartRunState: RunState.SUCCESS,
      });

      expect(events).toEqual(["upgrade"]);
      expect(outcome).toBeUndefined();
    });

    test("does not restart after a failed upgrade", async () => {
      const { outcome, events, printed } = await runScenario({
        upgradeOk: false,
        restartRunState: RunState.SUCCESS,
      });

      expect(events).toEqual(["upgrade"]);
      expect(outcome).toBeUndefined();
      expect(printed).toEqual(["Auto-upgrade failed: boom\n"]);
    });

    test("does nothing, not even prompting, in a process restarted after an automatic upgrade", async () => {
      const { outcome, events, printed } = await runScenario({
        restartedFromVersion: "1.0.0",
        upgradeStatus: "unset",
        restartRunState: RunState.SUCCESS,
      });

      expect(events).toEqual([]);
      expect(outcome).toBeUndefined();
      expect(printed).toEqual([]);
    });
  });
});
