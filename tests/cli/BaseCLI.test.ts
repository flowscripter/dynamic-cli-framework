import process from "node:process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import {
  getGlobalModifierCommandWithArgument,
  getSubCommand,
  getSubCommandWithOptionAndPositional,
} from "../fixtures/Command.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";
import { RunState } from "@flowscripter/dynamic-cli-framework-api";
import { ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import BaseCLI from "../../src/cli/BaseCLI.ts";
import { AUTO_UPGRADE_STARTUP_TASK_PRIORITY } from "../../src/runtime/lifecycle/priorities.ts";
import type { KeyValueService } from "@flowscripter/dynamic-cli-framework-api";
import {
  InstallMethod,
  KEY_VALUE_SERVICE_ID,
  SupportedArch,
  SupportedOs,
  UPGRADE_SERVICE_ID,
} from "@flowscripter/dynamic-cli-framework-api";
import type BaseCLIFeatureOptions from "../../src/cli/BaseCLIFeatureOptions.ts";
import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import StreamString from "../fixtures/StreamString.ts";
import { expectStringEquals, expectStringIncludes } from "../fixtures/util.ts";
import TtyTerminal from "../../src/terminal/TtyTerminal.ts";
import NonTtyTerminal from "../../src/terminal/NonTtyTerminal.ts";
import TtyStyler from "../../src/terminal/TtyStyler.ts";
import type KeyReader from "../../src/terminal/KeyReader.ts";
import { IMAGE_PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { PLUGIN_SERVICE_ID, SPAWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultUpgradeService from "../../src/service/upgrade/DefaultUpgradeService.ts";
import UpgradeServiceProvider from "../../src/service/upgrade/UpgradeServiceProvider.ts";
import CompletionServiceProvider from "../../src/service/completion/CompletionServiceProvider.ts";

const mockKeyReader: KeyReader = {
  enableRawMode() {},
  disableRawMode() {},
  readKey: () => Promise.resolve({}),
};

describe("BaseCLI tests", () => {
  test("BaseCLI no command specified works", async () => {
    const config = getCLIConfig();
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const baseCLI = new BaseCLI(
      config,
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      false,
      false,
      new TtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
      mockKeyReader,
    );

    baseCLI.addCommand(getSubCommandWithOptionAndPositional());

    const runResult = await baseCLI.run([]);

    expect(runResult.runState).toEqual(RunState.NO_COMMAND);
  });

  test("BaseCLI command execution works", async () => {
    const config = getCLIConfig();
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const baseCLI = new BaseCLI(
      config,
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      false,
      false,
      new TtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
      mockKeyReader,
    );

    let modifierHasRun = false;
    let subHasRun = false;

    const modifierCommand = getGlobalModifierCommandWithArgument("modifier", "m", 1, {
      type: ValueTypeName.STRING,
    });
    const option = {
      name: "foo",
      type: ValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);

    modifierCommand.execute = (): Promise<void> => {
      modifierHasRun = true;
      return Promise.resolve();
    };
    subCommand.execute = (): Promise<void> => {
      subHasRun = true;
      return Promise.resolve();
    };

    baseCLI.addCommand(modifierCommand);
    baseCLI.addCommand(subCommand);

    const runResult = await baseCLI.run(["unused", "--modifier=bar", "command", "--foo", "bar"]);

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(modifierHasRun).toBeTrue();
    expect(subHasRun).toBeTrue();
    expectStringEquals(dummyStdout.getString(), "");
    expectStringIncludes(dummyStderr.getString(), "Unused arg: unused");
  });

  test("BaseCLI run reports formatted error for missing explicit config file", async () => {
    const config = getCLIConfig();
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const baseCLI = new BaseCLI(
      config,
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      false,
      false,
      new TtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
      mockKeyReader,
      { configFileSupportEnabled: true },
    );

    baseCLI.addCommand(getSubCommand("command", [], []));

    const runResult = await baseCLI.run(["--config", "/nonexistent/path/config.json", "command"]);

    expect(runResult.runState).toEqual(RunState.RUNTIME_ERROR);
    expectStringIncludes(dummyStderr.getString(), "Execution error");
    expectStringIncludes(dummyStderr.getString(), "doesn't exist or not visible");
  });

  test("Command and service key value scope isolation works", async () => {
    // ensure we can remove the config file written by the test
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const appName = "foo" + Math.random();
    const baseCLI = new BaseCLI(
      getCLIConfig(appName),
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      false,
      false,
      new TtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
      mockKeyReader,
      {
        configFileSupportEnabled: true,
        keyValueServiceEnabled: true,
      },
    );

    let serviceProvider1Initialised = false;
    let serviceProvider2Initialised = false;
    let service1MethodInvoked = false;
    let service2MethodInvoked = false;
    let modifierHasRun = false;
    let subHasRun = false;

    const SERVICE_1 = "service1";
    const SERVICE_2 = "service2";

    interface ServiceInterface {
      serviceMethod(context: Context): Promise<void>;
    }

    class DefaultService1 implements ServiceInterface {
      // permanently bound to service1's own scope, set once during initService() - must never be
      // affected by whichever other scope happens to be "current" elsewhere.
      copyOfKeyValueService: KeyValueService | undefined;

      async serviceMethod(context: Context): Promise<void> {
        // service1's own scope: untouched by modifierCommand's writes to its own ("modifier")
        // scope, even though serviceMethod() is invoked from inside modifierCommand.execute().
        expect(await this.copyOfKeyValueService!.get("name")).toEqual("service1-init-value");

        // the context passed through from modifierCommand.execute() is still scoped to the
        // "modifier" command, not to service1 - it must see modifierCommand's own write.
        const commandScopedKeyValueService = context.getServiceById(
          KEY_VALUE_SERVICE_ID,
        ) as KeyValueService;
        expect(await commandScopedKeyValueService.get("name")).toEqual("modifierCommand-value");

        service1MethodInvoked = true;
      }
    }

    class DefaultService2 implements ServiceInterface {
      copyOfKeyValueService: KeyValueService | undefined;

      async serviceMethod(context: Context): Promise<void> {
        expect(await this.copyOfKeyValueService!.get("name")).toEqual("service2-init-value");

        const commandScopedKeyValueService = context.getServiceById(
          KEY_VALUE_SERVICE_ID,
        ) as KeyValueService;
        expect(await commandScopedKeyValueService.get("name")).toEqual("subCommand-value");

        service2MethodInvoked = true;
      }
    }

    class ServiceProvider1 implements ServiceProvider {
      readonly serviceId = SERVICE_1;
      readonly servicePriority = 1;

      defaultService1: DefaultService1 | undefined;

      getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
        this.defaultService1 = new DefaultService1();
        return Promise.resolve({
          service: this.defaultService1,
          commands: [],
        });
      }

      async initService(context: Context): Promise<void> {
        const keyValueService = context.getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService;

        expect(await keyValueService.has("name")).toBeFalse();
        await keyValueService.set("name", "service1-init-value");

        this.defaultService1!.copyOfKeyValueService = keyValueService;

        serviceProvider1Initialised = true;
      }
    }

    class ServiceProvider2 implements ServiceProvider {
      readonly serviceId = SERVICE_2;
      readonly servicePriority = 2;

      defaultService2: DefaultService2 | undefined;

      getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
        this.defaultService2 = new DefaultService2();
        return Promise.resolve({
          service: this.defaultService2,
          commands: [],
        });
      }

      async initService(context: Context): Promise<void> {
        const keyValueService = context.getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService;

        expect(await keyValueService.has("name")).toBeFalse();
        await keyValueService.set("name", "service2-init-value");

        this.defaultService2!.copyOfKeyValueService = keyValueService;

        serviceProvider2Initialised = true;
      }
    }

    const modifierCommand = getGlobalModifierCommandWithArgument("modifier", "m", 1, {
      type: ValueTypeName.STRING,
    });
    const option = {
      name: "foo",
      type: ValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);

    modifierCommand.execute = async (context): Promise<void> => {
      const keyValueService = context.getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService;

      expect(await keyValueService.has("name")).toBeFalse();
      await keyValueService.set("name", "modifierCommand-value");

      const service1 = context.getServiceById(SERVICE_1) as ServiceInterface;

      await service1.serviceMethod(context);

      // service1's serviceMethod() must not have leaked into this command's own scope.
      expect(await keyValueService.get("name")).toEqual("modifierCommand-value");

      modifierHasRun = true;
    };
    subCommand.execute = async (context): Promise<void> => {
      const keyValueService = context.getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService;

      expect(await keyValueService.has("name")).toBeFalse();
      await keyValueService.set("name", "subCommand-value");

      const service2 = context.getServiceById(SERVICE_2) as ServiceInterface;

      await service2.serviceMethod(context);

      expect(await keyValueService.get("name")).toEqual("subCommand-value");

      subHasRun = true;
    };

    baseCLI.addServiceProvider(new ServiceProvider1());
    baseCLI.addServiceProvider(new ServiceProvider2());
    baseCLI.addCommand(modifierCommand);
    baseCLI.addCommand(subCommand);

    const runResult = await baseCLI.run(["unused", "--modifier=bar", "command", "--foo", "bar"]);

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(serviceProvider1Initialised).toBeTrue();
    expect(serviceProvider2Initialised).toBeTrue();
    expect(modifierHasRun).toBeTrue();
    expect(service1MethodInvoked).toBeTrue();
    expect(subHasRun).toBeTrue();
    expect(service2MethodInvoked).toBeTrue();

    // cleanup - the config flush happens on a ShutdownTask
    // and this test file's static ShutdownServiceProvider guard means shutdown only truly runs
    // once across this whole file's tests so tolerate it if the file doesn't exist.
    await fs.rm(path.join(process.env.HOME!, `.${appName.replace(/\W/g, "")}.json`), {
      force: true,
    });
  });

  test("BaseCLI without keyReader and promptingEnabled false works", async () => {
    const config = getCLIConfig();
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const baseCLI = new BaseCLI(
      config,
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      false,
      false,
      new TtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
      undefined,
      { promptingEnabled: false },
    );

    baseCLI.addCommand(getSubCommandWithOptionAndPositional());

    const runResult = await baseCLI.run([]);

    expect(runResult.runState).toEqual(RunState.NO_COMMAND);
  });

  test("BaseCLI without keyReader and promptingEnabled true throws", () => {
    const config = getCLIConfig();
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const baseCLI = new BaseCLI(
      config,
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      false,
      false,
      new TtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
      undefined,
      { promptingEnabled: true },
    );

    baseCLI.addCommand(getSubCommandWithOptionAndPositional());

    expect(baseCLI.run([])).rejects.toThrow(
      "promptingEnabled requires a keyReader and a TTY stderr terminal",
    );
  });

  test("BaseCLI with non-TTY stderr terminal and promptingEnabled true throws even with a keyReader", () => {
    const config = getCLIConfig();
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const baseCLI = new BaseCLI(
      config,
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      false,
      false,
      new TtyTerminal(dummyStdout.writeStream),
      new NonTtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
      mockKeyReader,
      { promptingEnabled: true },
    );

    baseCLI.addCommand(getSubCommandWithOptionAndPositional());

    expect(baseCLI.run([])).rejects.toThrow(
      "promptingEnabled requires a keyReader and a TTY stderr terminal",
    );
  });

  test("BaseCLI with non-TTY stdout terminal skips ImagePrinterServiceProvider", async () => {
    const config = getCLIConfig();
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const baseCLI = new BaseCLI(
      config,
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      false,
      false,
      new NonTtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
      mockKeyReader,
      { imagePrinterServiceEnabled: true },
    );

    const command = getSubCommand("command", [], []);
    let serviceExists: boolean | undefined;
    command.execute = (context): Promise<void> => {
      serviceExists = context.doesServiceExist(IMAGE_PRINTER_SERVICE_ID);
      return Promise.resolve();
    };
    baseCLI.addCommand(command);

    const runResult = await baseCLI.run(["command"]);

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(serviceExists).toBeFalse();
  });

  test("BaseCLI with pluginServiceEnabled registers PluginServiceProvider, its command and SpawnServiceProvider", async () => {
    const config = getCLIConfig();
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const baseCLI = new BaseCLI(
      config,
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      false,
      false,
      new TtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
      mockKeyReader,
      {
        pluginServiceEnabled: true,
        pluginServiceRemoteConfig: {
          name: "test-remote",
          registryUrl: "https://registry.npmjs.org",
          packageJsonNamespace: "test-ns",
        },
        pluginServiceLocalConfig: {
          nodeModulesPath: "/tmp/nonexistent-plugin-service-provider-test/node_modules",
          packageJsonNamespace: "test-ns",
        },
      },
    );

    const command = getSubCommand("command", [], []);
    let serviceExists: boolean | undefined;
    let spawnServiceExists: boolean | undefined;
    command.execute = (context): Promise<void> => {
      serviceExists = context.doesServiceExist(PLUGIN_SERVICE_ID);
      spawnServiceExists = context.doesServiceExist(SPAWN_SERVICE_ID);
      return Promise.resolve();
    };
    baseCLI.addCommand(command);

    const runResult = await baseCLI.run(["command"]);

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(serviceExists).toBeTrue();
    expect(spawnServiceExists).toBeTrue();
  });

  test("BaseCLI without pluginServiceEnabled or spawnServiceEnabled does not register SpawnServiceProvider", async () => {
    const config = getCLIConfig();
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const baseCLI = new BaseCLI(
      config,
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      false,
      false,
      new TtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
      mockKeyReader,
      {},
    );

    const command = getSubCommand("command", [], []);
    let spawnServiceExists: boolean | undefined;
    command.execute = (context): Promise<void> => {
      spawnServiceExists = context.doesServiceExist(SPAWN_SERVICE_ID);
      return Promise.resolve();
    };
    baseCLI.addCommand(command);

    const runResult = await baseCLI.run(["command"]);

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(spawnServiceExists).toBeFalse();
  });

  test("UpgradeServiceProvider sets its dependencies before a lower-priority provider (e.g. a banner) can query it", async () => {
    const config = getCLIConfig();
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();

    const order: string[] = [];
    const originalSetContext = DefaultUpgradeService.prototype.setContext;
    DefaultUpgradeService.prototype.setContext = function (
      this: DefaultUpgradeService,
      ...args: Parameters<typeof originalSetContext>
    ) {
      order.push("upgrade-dependencies-set");
      return originalSetContext.apply(this, args);
    };

    try {
      const baseCLI = new BaseCLI(
        config,
        dummyStdout.writableStream,
        dummyStderr.writableStream,
        false,
        false,
        new TtyTerminal(dummyStdout.writeStream),
        new TtyTerminal(dummyStderr.writeStream),
        new TtyStyler(3),
        mockKeyReader,
        {
          upgradeServiceEnabled: true,
          fetchServiceEnabled: true,
          upgradeLocationsConfig: { supportedPlatforms: [] },
        },
      );

      // A consumer-registered provider at the banner's priority, which opportunistically calls
      // UpgradeService.getUpgradeCheckResult() from its own initService().
      const bannerLikeProvider: ServiceProvider = {
        serviceId: "test-banner-like-service",
        servicePriority: 50,
        getServiceInfo: (_cliConfig: CLIConfig): Promise<ServiceInfo> =>
          Promise.resolve({ commands: [] }),
        initService: (_context: Context): Promise<void> => {
          order.push("banner-like-init");
          return Promise.resolve();
        },
      };
      baseCLI.addServiceProvider(bannerLikeProvider);

      const command = getSubCommand("command", [], []);
      baseCLI.addCommand(command);

      const runResult = await baseCLI.run(["command"]);

      expect(runResult.runState).toEqual(RunState.SUCCESS);
      expect(order).toEqual(["upgrade-dependencies-set", "banner-like-init"]);
    } finally {
      DefaultUpgradeService.prototype.setContext = originalSetContext;
    }
  });

  test("auto-upgrade runs after a priority 50 banner-like task and before the completion prompt", async () => {
    const config = getCLIConfig();
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();

    const order: string[] = [];
    const originalSetContext = DefaultUpgradeService.prototype.setContext;
    const originalRunAutoUpgrade = UpgradeServiceProvider.prototype.runAutoUpgrade;
    const originalCompletionInit = CompletionServiceProvider.prototype.initService;
    DefaultUpgradeService.prototype.setContext = function (
      this: DefaultUpgradeService,
      ...args: Parameters<typeof originalSetContext>
    ) {
      order.push("upgrade-dependencies-set");
      return originalSetContext.apply(this, args);
    };
    UpgradeServiceProvider.prototype.runAutoUpgrade = () => {
      order.push("auto-upgrade");
      return Promise.resolve();
    };
    CompletionServiceProvider.prototype.initService = () => {
      order.push("completion-prompt");
      return Promise.resolve();
    };

    try {
      const baseCLI = new BaseCLI(
        config,
        dummyStdout.writableStream,
        dummyStderr.writableStream,
        false,
        false,
        new TtyTerminal(dummyStdout.writeStream),
        new TtyTerminal(dummyStderr.writeStream),
        new TtyStyler(3),
        mockKeyReader,
        {
          upgradeServiceEnabled: true,
          fetchServiceEnabled: true,
          completionServiceEnabled: true,
          upgradeLocationsConfig: { supportedPlatforms: [] },
        },
      );

      baseCLI.addStartupTask({
        id: "test-banner-like-task",
        priority: 50,
        run: () => {
          order.push("banner-like-task");
          return Promise.resolve();
        },
      });

      const command = getSubCommand("command", [], []);
      baseCLI.addCommand(command);

      const runResult = await baseCLI.run(["command"]);

      expect(runResult.runState).toEqual(RunState.SUCCESS);
      expect(AUTO_UPGRADE_STARTUP_TASK_PRIORITY).toBeLessThan(50);
      expect(order).toEqual([
        "upgrade-dependencies-set",
        "banner-like-task",
        "auto-upgrade",
        "completion-prompt",
      ]);
    } finally {
      DefaultUpgradeService.prototype.setContext = originalSetContext;
      UpgradeServiceProvider.prototype.runAutoUpgrade = originalRunAutoUpgrade;
      CompletionServiceProvider.prototype.initService = originalCompletionInit;
    }
  });

  test("a startup task's exitRequest becomes the run result, without running the command or printing usage", async () => {
    const config = getCLIConfig();
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const baseCLI = new BaseCLI(
      config,
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      false,
      false,
      new TtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
      mockKeyReader,
    );
    baseCLI.addStartupTask({
      id: "test-exit-task",
      priority: 10,
      run: () => Promise.resolve({ exitRequest: { runState: RunState.NO_COMMAND } }),
    });
    let commandRan = false;
    const command = getSubCommand("command", [], []);
    command.execute = () => {
      commandRan = true;
      return Promise.resolve();
    };
    baseCLI.addCommand(command);

    const runResult = await baseCLI.run(["command"]);

    expect(runResult).toEqual({ runState: RunState.NO_COMMAND });
    expect(commandRan).toBeFalse();
    expect(dummyStdout.getString()).toEqual("");
    expect(dummyStderr.getString()).toEqual("");
  });

  describe("restart after an automatic upgrade", () => {
    // Runs a CLI whose automatic upgrade is enabled and succeeds, with the DefaultUpgradeService
    // methods which would check, install and restart replaced by fakes.
    async function runWithSuccessfulAutoUpgrade(options: BaseCLIFeatureOptions) {
      const configFolder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
      const configLocation = path.join(configFolder, "config.json");
      await fs.writeFile(
        configLocation,
        JSON.stringify({
          "key-values": { services: { [UPGRADE_SERVICE_ID]: { "upgrade-status": "enabled" } } },
        }),
      );

      const restarts: Array<{ executable: string; args: ReadonlyArray<string> }> = [];
      const prototype = DefaultUpgradeService.prototype;
      const originals = {
        getUpgradeCheckResult: prototype.getUpgradeCheckResult,
        upgrade: prototype.upgrade,
        resolveUpgradedExecutable: prototype.resolveUpgradedExecutable,
        restart: prototype.restart,
      };
      prototype.getUpgradeCheckResult = () =>
        Promise.resolve({
          status: "checked",
          currentVersion: "1.0.0",
          latestVersion: "1.0.1",
          updateAvailable: true,
          os: SupportedOs.LINUX,
          arch: SupportedArch.X64,
          installMethod: InstallMethod.GITHUB_RELEASE,
        });
      prototype.upgrade = () =>
        Promise.resolve({ ok: true, oldVersion: "1.0.0", newVersion: "1.0.1" });
      prototype.resolveUpgradedExecutable = () => "/usr/local/bin/upgraded";
      prototype.restart = (executable, args) => {
        restarts.push({ executable, args });
        return Promise.resolve(RunState.EXECUTION_ERROR);
      };

      try {
        const dummyStdout = new StreamString();
        const dummyStderr = new StreamString();
        const baseCLI = new BaseCLI(
          getCLIConfig(),
          dummyStdout.writableStream,
          dummyStderr.writableStream,
          false,
          false,
          new TtyTerminal(dummyStdout.writeStream),
          new TtyTerminal(dummyStderr.writeStream),
          new TtyStyler(3),
          mockKeyReader,
          {
            configFileSupportEnabled: true,
            keyValueServiceEnabled: true,
            upgradeServiceEnabled: true,
            upgradeLocationsConfig: { supportedPlatforms: [] },
            ...options,
          },
        );
        let commandRan = false;
        const command = getSubCommand("command", [], []);
        command.execute = () => {
          commandRan = true;
          return Promise.resolve();
        };
        baseCLI.addCommand(command);

        const args = ["--config", configLocation, "command"];
        const runResult = await baseCLI.run(args);
        return { runResult, restarts, commandRan, args };
      } finally {
        Object.assign(prototype, originals);
        await fs.rm(configFolder, { recursive: true, force: true });
      }
    }

    test("restarts with the CLI args and returns the restarted process's run state when enabled", async () => {
      const { runResult, restarts, commandRan, args } = await runWithSuccessfulAutoUpgrade({
        restartAfterAutoUpgrade: true,
      });

      expect(restarts).toEqual([{ executable: "/usr/local/bin/upgraded", args }]);
      expect(runResult).toEqual({ runState: RunState.EXECUTION_ERROR });
      expect(commandRan).toBeFalse();
    });

    test("does not restart by default", async () => {
      const { runResult, restarts, commandRan } = await runWithSuccessfulAutoUpgrade({});

      expect(restarts).toEqual([]);
      expect(runResult.runState).toEqual(RunState.SUCCESS);
      expect(commandRan).toBeTrue();
    });
  });
});
