import {
  getGlobalModifierCommandWithArgument,
  getSubCommand,
  getSubCommandWithOptionAndPositional,
} from "../fixtures/Command.ts";
import { Buffer } from "@std/streams";
import { assertEquals } from "@std/assert";
import * as path from "@std/path";
import { expectBufferStringIncludes } from "../fixtures/util.ts";
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

Deno.test("BaseCLI no command specified works", async () => {
  const config = getCLIConfig();
  const stdoutBuffer = new Buffer();
  const stderrBuffer = new Buffer();
  const baseCLI = new BaseCLI(
    config,
    stdoutBuffer.writable,
    stderrBuffer.writable,
    false,
  );

  baseCLI.addCommand(getSubCommandWithOptionAndPositional());

  const runResult = await baseCLI.run([]);

  assertEquals(runResult.runState, RunState.NO_COMMAND);
});

Deno.test("BaseCLI command execution works", async () => {
  const config = getCLIConfig();
  const stdoutBuffer = new Buffer();
  const stderrBuffer = new Buffer();
  const baseCLI = new BaseCLI(
    config,
    stdoutBuffer.writable,
    stderrBuffer.writable,
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

  assertEquals(runResult.runState, RunState.SUCCESS);
  assertEquals(modifierHasRun, true);
  assertEquals(subHasRun, true);
  expectBufferStringIncludes(stdoutBuffer, "");
  expectBufferStringIncludes(stderrBuffer, "Unused arg: unused");
});

Deno.test("Command and service key value scope isolation works", async () => {
  // ensure we can remove the config file written by the test
  const appName = "foo" + Math.random();
  const baseCLI = new BaseCLI(
    getCLIConfig(appName),
    new Buffer().writable,
    new Buffer().writable,
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
    serviceMethod(context: Context): void;
  }

  class DefaultService1 implements ServiceInterface {
    copyOfKeyValueService: KeyValueService | undefined;

    serviceMethod(context: Context): void {
      // should only have access to the modifierCommand KV scope
      assertEquals(this.copyOfKeyValueService!.hasKey("name"), true);
      assertEquals(
        this.copyOfKeyValueService!.getKey("name"),
        "modifierCommand",
      );
      this.copyOfKeyValueService!.setKey(
        "name",
        "defaultService1+modifierCommand",
      );

      const keyValueService = context.getServiceById(
        KEY_VALUE_SERVICE_ID,
      ) as KeyValueService;

      // should only have access to the modifierCommand KV scope
      assertEquals(keyValueService.hasKey("name"), true);
      assertEquals(
        this.copyOfKeyValueService!.getKey("name"),
        "defaultService1+modifierCommand",
      );

      service1MethodInvoked = true;
    }
  }

  class DefaultService2 implements ServiceInterface {
    copyOfKeyValueService: KeyValueService | undefined;

    serviceMethod(context: Context): void {
      // should only have access to the modifierCommand KV scope
      assertEquals(this.copyOfKeyValueService!.hasKey("name"), true);
      assertEquals(this.copyOfKeyValueService!.getKey("name"), "subCommand");
      this.copyOfKeyValueService!.setKey(
        "name",
        "defaultService2+subCommand",
      );

      const keyValueService = context.getServiceById(
        KEY_VALUE_SERVICE_ID,
      ) as KeyValueService;

      // should only have access to the subCommand KV scope
      assertEquals(keyValueService.hasKey("name"), true);
      assertEquals(
        this.copyOfKeyValueService!.getKey("name"),
        "defaultService2+subCommand",
      );

      service2MethodInvoked = true;
    }
  }

  class ServiceProvider1 implements ServiceProvider {
    readonly serviceId = SERVICE_1;
    readonly servicePriority = 1;

    defaultService1: DefaultService1 | undefined;

    provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
      this.defaultService1 = new DefaultService1();
      return Promise.resolve({
        service: this.defaultService1,
        commands: [],
      });
    }

    initService(context: Context): Promise<void> {
      const keyValueService = context.getServiceById(
        KEY_VALUE_SERVICE_ID,
      ) as KeyValueService;

      // should only have access to the ServiceProvider1 KV scope
      assertEquals(keyValueService.hasKey("name"), false);
      keyValueService.setKey("name", "defaultService2");

      // take a copy to check later when service is accessed via a command
      this.defaultService1!.copyOfKeyValueService = keyValueService;

      serviceProvider1Initialised = true;
      return Promise.resolve(undefined);
    }
  }

  class ServiceProvider2 implements ServiceProvider {
    readonly serviceId = SERVICE_2;
    readonly servicePriority = 2;

    defaultService2: DefaultService2 | undefined;

    provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
      this.defaultService2 = new DefaultService2();
      return Promise.resolve({
        service: this.defaultService2,
        commands: [],
      });
    }

    initService(context: Context): Promise<void> {
      const keyValueService = context.getServiceById(
        KEY_VALUE_SERVICE_ID,
      ) as KeyValueService;

      // should only have access to the ServiceProvider2 KV scope
      assertEquals(keyValueService.hasKey("name"), false);
      keyValueService.setKey("name", "defaultService2");

      // take a copy to check later when service is accessed via a command
      this.defaultService2!.copyOfKeyValueService = keyValueService;

      serviceProvider2Initialised = true;
      return Promise.resolve(undefined);
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

  modifierCommand.execute = (context): Promise<void> => {
    const keyValueService = context.getServiceById(
      KEY_VALUE_SERVICE_ID,
    ) as KeyValueService;

    // should only have access to the modifierCommand KV scope
    assertEquals(keyValueService.hasKey("name"), false);
    keyValueService.setKey("name", "modifierCommand");

    const service1 = context.getServiceById(SERVICE_1) as ServiceInterface;

    service1.serviceMethod(context);

    modifierHasRun = true;
    return Promise.resolve();
  };
  subCommand.execute = (context): Promise<void> => {
    const keyValueService = context.getServiceById(
      KEY_VALUE_SERVICE_ID,
    ) as KeyValueService;

    // should only have access to the subCommand KV scope
    assertEquals(keyValueService.hasKey("name"), false);
    keyValueService.setKey("name", "subCommand");

    const service2 = context.getServiceById(SERVICE_2) as ServiceInterface;

    service2.serviceMethod(context);

    subHasRun = true;
    return Promise.resolve();
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

  assertEquals(runResult.runState, RunState.SUCCESS);
  assertEquals(serviceProvider1Initialised, true);
  assertEquals(serviceProvider2Initialised, true);
  assertEquals(modifierHasRun, true);
  assertEquals(service1MethodInvoked, true);
  assertEquals(subHasRun, true);
  assertEquals(service2MethodInvoked, true);

  // cleanup
  await Deno.remove(
    path.join(Deno.env.get("HOME")!, `.${appName.replace(/\W/g, "")}.json`),
  );
});
