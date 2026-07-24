import { describe, expect, test } from "bun:test";
import FetchServiceProvider from "../../../src/service/fetch/FetchServiceProvider.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import { SHUTDOWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { FetchService } from "@flowscripter/dynamic-cli-framework-api";

function getCLIConfig(): CLIConfig {
  return { name: "testcli", description: "Test CLI", version: "1.0.0" };
}

describe("FetchServiceProvider tests", () => {
  test("has correct serviceId", () => {
    const provider = new FetchServiceProvider(57);
    expect(provider.serviceId).toEqual("@flowscripter/dynamic-cli-framework/fetch-service");
  });

  test("has correct servicePriority", () => {
    const provider = new FetchServiceProvider(57);
    expect(provider.servicePriority).toEqual(57);
  });

  test("getServiceInfo returns a service with no commands", async () => {
    const provider = new FetchServiceProvider(57);
    const serviceInfo = await provider.getServiceInfo(getCLIConfig());

    expect(serviceInfo.service).toBeDefined();
    expect(serviceInfo.commands.length).toEqual(0);
  });

  test("initService wires ShutdownService into the service returned by getServiceInfo", async () => {
    const provider = new FetchServiceProvider(57);
    const serviceInfo = await provider.getServiceInfo(getCLIConfig());
    const fetchService = serviceInfo.service as FetchService;

    const context = new DefaultContext(getCLIConfig());
    context.addServiceInstance(SHUTDOWN_SERVICE_ID, {
      addShutdownListener: () => {},
      enterLongRunningMode: () => {},
      leaveLongRunningMode: () => {},
      isShutdownRequested: false,
    });

    await provider.initService(context);

    const server = Bun.serve({ port: 0, fetch: () => new Response("ok") });
    try {
      const response = await fetchService.fetch(`http://localhost:${server.port}`);
      expect(await response.text()).toEqual("ok");
    } finally {
      server.stop(true);
    }
  });
});
