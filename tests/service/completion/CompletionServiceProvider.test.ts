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

  test("initService skips when completion-status is 'installed'", async () => {
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
    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/key-value-service",
      {
        hasKey: (key: string) => Promise.resolve(key === "completion-status"),
        getKey: () => Promise.resolve("installed"),
        setKey: () => Promise.resolve(),
        deleteKey: () => Promise.resolve(),
      },
    );
    await expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService skips when completion-status is 'declined'", async () => {
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
    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/key-value-service",
      {
        hasKey: (key: string) => Promise.resolve(key === "completion-status"),
        getKey: () => Promise.resolve("declined"),
        setKey: () => Promise.resolve(),
        deleteKey: () => Promise.resolve(),
      },
    );
    await expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService skips when promptEnabled is false", async () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service);
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());
    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/prompter-service",
      {
        promptEnabled: false,
        prompt: () => Promise.resolve({ name: "", value: false }),
        promptAll: () => Promise.resolve([]),
      },
    );
    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/key-value-service",
      {
        hasKey: () => Promise.resolve(false),
        getKey: () => Promise.resolve(""),
        setKey: () => Promise.resolve(),
        deleteKey: () => Promise.resolve(),
      },
    );
    await expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService stores 'declined' when user says no to completion", async () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service);
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());

    let storedKey = "";
    let storedValue = "";
    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/prompter-service",
      {
        promptEnabled: true,
        prompt: () =>
          Promise.resolve({ name: "enable-completion", value: false }),
        promptAll: () => Promise.resolve([]),
      },
    );
    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/key-value-service",
      {
        hasKey: () => Promise.resolve(false),
        getKey: () => Promise.resolve(""),
        setKey: (key: string, value: string) => {
          storedKey = key;
          storedValue = value;
          return Promise.resolve();
        },
        deleteKey: () => Promise.resolve(),
      },
    );

    await provider.initService(context);
    expect(storedKey).toEqual("completion-status");
    expect(storedValue).toEqual("declined");
  });

  test("initService installs completion when user accepts and selects shell", async () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service);
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());

    const storedEntries: Array<{ key: string; value: string }> = [];
    const promptResponses = new Map<string, unknown>();
    promptResponses.set("enable-completion", true);
    promptResponses.set("shell-type", "bash");

    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/prompter-service",
      {
        promptEnabled: true,
        prompt: (promptDef: { name: string }) =>
          Promise.resolve({
            name: promptDef.name,
            value: promptResponses.get(promptDef.name),
          }),
        promptAll: () => Promise.resolve([]),
      },
    );
    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/key-value-service",
      {
        hasKey: () => Promise.resolve(false),
        getKey: () => Promise.resolve(""),
        setKey: (key: string, value: string) => {
          storedEntries.push({ key, value });
          return Promise.resolve();
        },
        deleteKey: () => Promise.resolve(),
      },
    );

    let infoMessage = "";
    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/printer-service",
      {
        info: (msg: string) => {
          infoMessage = msg;
          return Promise.resolve();
        },
        warn: () => Promise.resolve(),
        error: () => Promise.resolve(),
        print: () => Promise.resolve(),
      },
    );

    await provider.initService(context);

    const statusEntry = storedEntries.find(
      (e) => e.key === "completion-status",
    );
    expect(statusEntry).toBeDefined();
    expect(statusEntry!.value).toEqual("installed");
    expect(infoMessage).toContain("Shell completion installed for bash");
  });

  test("initService shows error when installation fails", async () => {
    const service = new DefaultCompletionService();
    // Override validateShellEnvironment to throw
    const originalValidate = service.validateShellEnvironment.bind(service);
    service.validateShellEnvironment = () => {
      throw new Error("test error");
    };

    const provider = new CompletionServiceProvider(60, service);
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());

    const promptResponses = new Map<string, unknown>();
    promptResponses.set("enable-completion", true);
    promptResponses.set("shell-type", "bash");

    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/prompter-service",
      {
        promptEnabled: true,
        prompt: (promptDef: { name: string }) =>
          Promise.resolve({
            name: promptDef.name,
            value: promptResponses.get(promptDef.name),
          }),
        promptAll: () => Promise.resolve([]),
      },
    );
    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/key-value-service",
      {
        hasKey: () => Promise.resolve(false),
        getKey: () => Promise.resolve(""),
        setKey: () => Promise.resolve(),
        deleteKey: () => Promise.resolve(),
      },
    );

    let errorMessage = "";
    context.addServiceInstance(
      "@flowscripter/dynamic-cli-framework/printer-service",
      {
        info: () => Promise.resolve(),
        warn: () => Promise.resolve(),
        error: (msg: string) => {
          errorMessage = msg;
          return Promise.resolve();
        },
        print: () => Promise.resolve(),
      },
    );

    await provider.initService(context);
    expect(errorMessage).toContain("Failed to install completion");
    expect(errorMessage).toContain("test error");

    // Restore
    service.validateShellEnvironment = originalValidate;
  });
});
