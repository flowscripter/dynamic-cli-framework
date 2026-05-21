import { describe, expect, test } from "bun:test";
import CompletionServiceProvider from "../../../src/service/completion/CompletionServiceProvider.ts";
import DefaultCompletionService from "../../../src/service/completion/DefaultCompletionService.ts";
import { COMPLETION_SERVICE_ID } from "../../../src/api/service/core/CompletionService.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import type CLIConfig from "../../../src/api/CLIConfig.ts";

function getCLIConfig(): CLIConfig {
  return { name: "testcli", description: "Test CLI", version: "1.0.0" };
}

describe("CompletionServiceProvider", () => {
  test("has correct serviceId", () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service);
    expect(provider.serviceId).toEqual(COMPLETION_SERVICE_ID);
  });

  test("has correct servicePriority", () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service);
    expect(provider.servicePriority).toEqual(60);
  });

  test("getServiceInfo returns service and no commands", async () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service);
    const serviceInfo = await provider.getServiceInfo(getCLIConfig());

    expect(serviceInfo.service).toBe(service);
    expect(serviceInfo.commands.length).toEqual(0);
  });

  test("initService resolves when prompter service not available", async () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service);
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());
    await expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService resolves when key-value service not available", async () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service);
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());
    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/prompter-service",
      {
        promptEnabled: true,
        prompt: () => Promise.resolve({ name: "", value: false }),
        promptAll: () => Promise.resolve([]),
      },
    );
    await expect(provider.initService(context)).resolves.toBeUndefined();
  });
});
