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
import { RunState } from "../../src/api/RunResult.ts";
import { ArgumentValueTypeName } from "../../src/api/argument/ArgumentValueTypes.ts";
import BaseCLI from "../../src/cli/BaseCLI.ts";
import type KeyValueService from "../../src/api/service/core/KeyValueService.ts";
import {
  KEY_VALUE_SERVICE_ID,
} from "../../src/api/service/core/KeyValueService.ts";
import type {
  ServiceInfo,
  ServiceProvider,
} from "../../src/api/service/ServiceProvider.ts";
import type Context from "../../src/api/Context.ts";
import type CLIConfig from "../../src/api/CLIConfig.ts";
import StreamString from "../fixtures/StreamString.ts";
import { expectStringEquals, expectStringIncludes } from "../fixtures/util.ts";
import TtyTerminal from "../../src/terminal/TtyTerminal.ts";
import TtyStyler from "../../src/terminal/TtyStyler.ts";

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
      false,
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
      false,
    );

    let modifierHasRun = false;
    let subHasRun = false;

    const modifierCommand = getGlobalModifierCommandWithArgument(
      "modifier",
      "m",
      1,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
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

    const runResult = await baseCLI.run([
      "unused",
      "--modifier=bar",
      "command",
      "--foo",
      "bar",
    ]);

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(modifierHasRun).toBeTrue();
    expect(subHasRun).toBeTrue();
    expectStringEquals(dummyStdout.getString(), "");
    expectStringIncludes(dummyStderr.getString(), "Unused arg: unused");
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
      false,
      true,
      true,
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
      copyOfKeyValueService: KeyValueService | undefined;

      async serviceMethod(context: Context): Promise<void> {
        expect(await this.copyOfKeyValueService!.hasKey("name")).toBeTrue();
        expect(
          await this.copyOfKeyValueService!.getKey("name"),
        ).toEqual(
          "modifierCommand",
        );
        await this.copyOfKeyValueService!.setKey(
          "name",
          "defaultService1+modifierCommand",
        );

        const keyValueService = context.getServiceById(
          KEY_VALUE_SERVICE_ID,
        ) as KeyValueService;

        expect(await keyValueService.hasKey("name")).toBeTrue();
        expect(
          await this.copyOfKeyValueService!.getKey("name"),
        ).toEqual(
          "defaultService1+modifierCommand",
        );

        service1MethodInvoked = true;
      }
    }

    class DefaultService2 implements ServiceInterface {
      copyOfKeyValueService: KeyValueService | undefined;

      async serviceMethod(context: Context): Promise<void> {
        expect(await this.copyOfKeyValueService!.hasKey("name")).toBeTrue();
        expect(await this.copyOfKeyValueService!.getKey("name")).toEqual(
          "subCommand",
        );
        await this.copyOfKeyValueService!.setKey(
          "name",
          "defaultService2+subCommand",
        );

        const keyValueService = context.getServiceById(
          KEY_VALUE_SERVICE_ID,
        ) as KeyValueService;

        expect(await keyValueService.hasKey("name")).toBeTrue();
        expect(
          await this.copyOfKeyValueService!.getKey("name"),
        ).toEqual(
          "defaultService2+subCommand",
        );

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
        const keyValueService = context.getServiceById(
          KEY_VALUE_SERVICE_ID,
        ) as KeyValueService;

        expect(await keyValueService.hasKey("name")).toBeFalse();
        await keyValueService.setKey("name", "defaultService2");

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
        const keyValueService = context.getServiceById(
          KEY_VALUE_SERVICE_ID,
        ) as KeyValueService;

        expect(await keyValueService.hasKey("name")).toBeFalse();
        await keyValueService.setKey("name", "defaultService2");

        this.defaultService2!.copyOfKeyValueService = keyValueService;

        serviceProvider2Initialised = true;
      }
    }

    const modifierCommand = getGlobalModifierCommandWithArgument(
      "modifier",
      "m",
      1,
      {
        type: ArgumentValueTypeName.STRING,
      },
    );
    const option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "f",
    };
    const subCommand = getSubCommand("command", [option], []);

    modifierCommand.execute = async (context): Promise<void> => {
      const keyValueService = context.getServiceById(
        KEY_VALUE_SERVICE_ID,
      ) as KeyValueService;

      expect(await keyValueService.hasKey("name")).toBeFalse();
      await keyValueService.setKey("name", "modifierCommand");

      const service1 = context.getServiceById(SERVICE_1) as ServiceInterface;

      await service1.serviceMethod(context);

      modifierHasRun = true;
    };
    subCommand.execute = async (context): Promise<void> => {
      const keyValueService = context.getServiceById(
        KEY_VALUE_SERVICE_ID,
      ) as KeyValueService;

      expect(await keyValueService.hasKey("name")).toBeFalse();
      await keyValueService.setKey("name", "subCommand");

      const service2 = context.getServiceById(SERVICE_2) as ServiceInterface;

      await service2.serviceMethod(context);

      subHasRun = true;
    };

    baseCLI.addServiceProvider(new ServiceProvider1());
    baseCLI.addServiceProvider(new ServiceProvider2());
    baseCLI.addCommand(modifierCommand);
    baseCLI.addCommand(subCommand);

    const runResult = await baseCLI.run([
      "unused",
      "--modifier=bar",
      "command",
      "--foo",
      "bar",
    ]);

    expect(runResult.runState).toEqual(RunState.SUCCESS);
    expect(serviceProvider1Initialised).toBeTrue();
    expect(serviceProvider2Initialised).toBeTrue();
    expect(modifierHasRun).toBeTrue();
    expect(service1MethodInvoked).toBeTrue();
    expect(subHasRun).toBeTrue();
    expect(service2MethodInvoked).toBeTrue();

    // cleanup
    await fs.rm(
      path.join(process.env.HOME!, `.${appName.replace(/\W/g, "")}.json`),
    );
  });
});
