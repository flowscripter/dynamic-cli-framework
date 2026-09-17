import process from "node:process";
import fs from "node:fs/promises";
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
import type { KeyValueService } from "@flowscripter/dynamic-cli-framework-api";
import { KEY_VALUE_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
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
import { PLUGIN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultUpgradeService from "../../src/service/upgrade/DefaultUpgradeService.ts";

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

    // cleanup - the config flush now happens on a ShutdownTask (see ConfigurationServiceProvider),
    // and this test file's static ShutdownServiceProvider guard means shutdown only truly runs
    // once across this whole file's tests, so the file may not exist here; tolerate that.
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

  test("BaseCLI with pluginServiceEnabled registers PluginServiceProvider and its command", async () => {
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
    command.execute = (context): Promise<void> => {
      serviceExists = context.doesServiceExist(PLUGIN_SERVICE_ID);
      return Promise.resolve();
    };
    baseCLI.addCommand(command);

    const runResult = await baseCLI.run(["command"]);

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(serviceExists).toBeTrue();
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

      // Simulates a consumer-registered BannerServiceProvider, which opportunistically calls
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
});
