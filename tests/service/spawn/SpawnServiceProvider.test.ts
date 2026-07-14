import { describe, expect, test } from "bun:test";
import SpawnServiceProvider from "../../../src/service/spawn/SpawnServiceProvider.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID, SHUTDOWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { SpawnService } from "@flowscripter/dynamic-cli-framework-api";

function getCLIConfig(): CLIConfig {
  return { name: "testcli", description: "Test CLI", version: "1.0.0" };
}

describe("SpawnServiceProvider tests", () => {
  test("has correct serviceId", () => {
    const provider = new SpawnServiceProvider(58);
    expect(provider.serviceId).toEqual("@flowscripter/dynamic-cli-framework/spawn-service");
  });

  test("has correct servicePriority", () => {
    const provider = new SpawnServiceProvider(58);
    expect(provider.servicePriority).toEqual(58);
  });

  test("getServiceInfo returns a service with no commands", async () => {
    const provider = new SpawnServiceProvider(58);
    const serviceInfo = await provider.getServiceInfo(getCLIConfig());

    expect(serviceInfo.service).toBeDefined();
    expect(serviceInfo.commands.length).toEqual(0);
  });

  test("initService wires PrinterService/ShutdownService into the service returned by getServiceInfo", async () => {
    const provider = new SpawnServiceProvider(58);
    const serviceInfo = await provider.getServiceInfo(getCLIConfig());
    const spawnService = serviceInfo.service as SpawnService;

    const context = new DefaultContext(getCLIConfig());
    context.addServiceInstance(PRINTER_SERVICE_ID, {
      hideSpinner: () => Promise.resolve(),
      hideAllProgressBars: () => Promise.resolve(),
    });
    context.addServiceInstance(SHUTDOWN_SERVICE_ID, {
      addShutdownListener: () => {},
      enterLongRunningMode: () => {},
      leaveLongRunningMode: () => {},
      isShutdownRequested: false,
    });

    await provider.initService(context);

    const result = await spawnService.spawn(["echo", "hello"]);
    expect(result).toEqual({ ok: true, exitCode: 0 });
  });
});
