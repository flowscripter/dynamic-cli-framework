import {
  getGlobalModifierCommandWithArgument,
  getSubCommand,
  getSubCommandWithOptionAndPositional,
} from "../fixtures/Command.ts";
import { assertEquals, Buffer, describe, it } from "../test_deps.ts";
import { expectBufferStringIncludes } from "../fixtures/util.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";
import { RunState } from "../../src/api/RunResult.ts";
import { ArgumentValueTypeName } from "../../src/api/argument/ArgumentValueTypes.ts";
import BaseCLI from "../../src/cli/BaseCLI.ts";
import KeyValueService, {
  KEY_VALUE_SERVICE_ID,
} from "../../src/api/service/core/KeyValueService.ts";
import ServiceProvider, {
  ServiceInfo,
} from "../../src/api/service/ServiceProvider.ts";
import Context from "../../src/api/Context.ts";
import CLIConfig from "../../src/api/CLIConfig.ts";

describe("BaseCLI", () => {
  it("BaseCLI no command specified works", async () => {
    const config = getCLIConfig();
    const stdoutBuffer = new Buffer();
    const stderrBuffer = new Buffer();
    const baseCLI = new BaseCLI(config, stdoutBuffer, stderrBuffer, false);

    baseCLI.addCommand(getSubCommandWithOptionAndPositional());

    const runResult = await baseCLI.run([]);

    assertEquals(runResult.runState, RunState.NO_COMMAND);
  });

  it("BaseCLI command execution works", async () => {
    const config = getCLIConfig();
    const stdoutBuffer = new Buffer();
    const stderrBuffer = new Buffer();
    const baseCLI = new BaseCLI(config, stdoutBuffer, stderrBuffer, false);

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

  it("Command and service key value scope isolation works", async () => {
    const baseCLI = new BaseCLI(
      getCLIConfig(),
      new Buffer(),
      new Buffer(),
      false,
    );

    let serviceProvider1Initialised = false;
    let serviceProvider2Initialised = false;
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

      const service1 = context.getServiceById(SERVICE_1) as ServiceInterface;

      service1.serviceMethod(context);

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
    assertEquals(subHasRun, true);
  });
});
