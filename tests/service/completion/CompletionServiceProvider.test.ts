import { describe, expect, test } from "bun:test";
import CompletionServiceProvider from "../../../src/service/completion/CompletionServiceProvider.ts";
import DefaultCompletionService from "../../../src/service/completion/DefaultCompletionService.ts";
import { COMPLETION_SERVICE_ID } from "../../../src/api/service/core/CompletionService.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import type CLIConfig from "../../../src/api/CLIConfig.ts";
import { CompletionGroupCommand } from "../../../src/service/completion/command/CompletionGroupCommand.ts";
import { getCommandRegistry } from "../../fixtures/CommandRegistry.ts";

function getCLIConfig(): CLIConfig {
  return { name: "testcli", description: "Test CLI", version: "1.0.0" };
}

describe("CompletionServiceProvider", () => {
  test("has correct serviceId", () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    expect(provider.serviceId).toEqual(COMPLETION_SERVICE_ID);
  });

  test("has correct servicePriority", () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    expect(provider.servicePriority).toEqual(60);
  });

  test("getServiceInfo returns service and completion group command", async () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    const serviceInfo = await provider.getServiceInfo(getCLIConfig());

    expect(serviceInfo.service).toBe(service);
    expect(serviceInfo.commands.length).toEqual(1);
    expect(serviceInfo.commands[0]).toBeInstanceOf(CompletionGroupCommand);
  });

  test("initService resolves when prompter service not available", async () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());
    await expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService resolves when key-value service not available", async () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/prompter-service", {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    await expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService skips when completion-status is 'installed'", async () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/prompter-service", {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/key-value-service", {
      hasKey: (key: string) => Promise.resolve(key === "completion-status"),
      getKey: () => Promise.resolve("installed"),
      setKey: () => Promise.resolve(),
      deleteKey: () => Promise.resolve(),
    });
    await expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService skips when completion-status is 'declined'", async () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/prompter-service", {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/key-value-service", {
      hasKey: (key: string) => Promise.resolve(key === "completion-status"),
      getKey: () => Promise.resolve("declined"),
      setKey: () => Promise.resolve(),
      deleteKey: () => Promise.resolve(),
    });
    await expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService skips when promptEnabled is false", async () => {
    const service = new DefaultCompletionService();
    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/prompter-service", {
      promptEnabled: false,
      prompt: () => Promise.resolve({ name: "", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/key-value-service", {
      hasKey: () => Promise.resolve(false),
      getKey: () => Promise.resolve(""),
      setKey: () => Promise.resolve(),
      deleteKey: () => Promise.resolve(),
    });
    await expect(provider.initService(context)).resolves.toBeUndefined();
  });

  test("initService skips when no supported shells detected", async () => {
    const service = new DefaultCompletionService();
    service.validateShellEnvironment = () => Promise.resolve(false);
    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());

    let promptCalled = false;
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/prompter-service", {
      promptEnabled: true,
      prompt: () => {
        promptCalled = true;
        return Promise.resolve({ name: "", value: false });
      },
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/key-value-service", {
      hasKey: () => Promise.resolve(false),
      getKey: () => Promise.resolve(""),
      setKey: () => Promise.resolve(),
      deleteKey: () => Promise.resolve(),
    });

    await provider.initService(context);
    expect(promptCalled).toBe(false);
  });

  test("initService stores 'declined' when user says no to completion", async () => {
    const service = new DefaultCompletionService();
    service.validateShellEnvironment = () => Promise.resolve(true);
    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());

    let storedKey = "";
    let storedValue = "";
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/prompter-service", {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "enable-completion", value: false }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/key-value-service", {
      hasKey: () => Promise.resolve(false),
      getKey: () => Promise.resolve(""),
      setKey: (key: string, value: string) => {
        storedKey = key;
        storedValue = value;
        return Promise.resolve();
      },
      deleteKey: () => Promise.resolve(),
    });

    await provider.initService(context);
    expect(storedKey).toEqual("completion-status");
    expect(storedValue).toEqual("declined");
  });

  test("initService skips shell prompt when only one shell detected", async () => {
    const service = new DefaultCompletionService();
    service.validateShellEnvironment = (shell) => Promise.resolve(shell === "bash");
    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());

    const storedEntries: Array<{ key: string; value: string }> = [];
    const promptNames: string[] = [];

    context.addServiceInstance("@flowscripter/dynamic-cli-framework/prompter-service", {
      promptEnabled: true,
      prompt: (promptDef: { name: string }) => {
        promptNames.push(promptDef.name);
        return Promise.resolve({
          name: promptDef.name,
          value: true,
        });
      },
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/key-value-service", {
      hasKey: () => Promise.resolve(false),
      getKey: () => Promise.resolve(""),
      setKey: (key: string, value: string) => {
        storedEntries.push({ key, value });
        return Promise.resolve();
      },
      deleteKey: () => Promise.resolve(),
    });

    let infoMessage = "";
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/printer-service", {
      info: (msg: string) => {
        infoMessage = msg;
        return Promise.resolve();
      },
      warn: () => Promise.resolve(),
      error: () => Promise.resolve(),
      print: () => Promise.resolve(),
    });

    await provider.initService(context);

    expect(promptNames).toEqual(["enable-completion"]);
    const statusEntry = storedEntries.find((e) => e.key === "completion-status");
    expect(statusEntry).toBeDefined();
    expect(statusEntry!.value).toEqual("installed");
    expect(infoMessage).toContain("Shell completion installed for bash");
  });

  test("initService shows shell prompt with default when multiple shells detected", async () => {
    const service = new DefaultCompletionService();
    service.validateShellEnvironment = (shell) =>
      Promise.resolve(shell === "bash" || shell === "zsh");
    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());

    const storedEntries: Array<{ key: string; value: string }> = [];
    const promptResponses = new Map<string, unknown>();
    promptResponses.set("enable-completion", true);
    promptResponses.set("shell-type", "zsh");

    let shellPromptDefault: unknown;
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/prompter-service", {
      promptEnabled: true,
      prompt: (promptDef: { name: string; defaultOption?: { returnedValue: unknown } }) => {
        if (promptDef.name === "shell-type") {
          shellPromptDefault = promptDef.defaultOption;
        }
        return Promise.resolve({
          name: promptDef.name,
          value: promptResponses.get(promptDef.name),
        });
      },
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/key-value-service", {
      hasKey: () => Promise.resolve(false),
      getKey: () => Promise.resolve(""),
      setKey: (key: string, value: string) => {
        storedEntries.push({ key, value });
        return Promise.resolve();
      },
      deleteKey: () => Promise.resolve(),
    });

    let infoMessage = "";
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/printer-service", {
      info: (msg: string) => {
        infoMessage = msg;
        return Promise.resolve();
      },
      warn: () => Promise.resolve(),
      error: () => Promise.resolve(),
      print: () => Promise.resolve(),
    });

    await provider.initService(context);

    expect(shellPromptDefault).toEqual({
      displayValue: "bash",
      returnedValue: "bash",
    });
    const statusEntry = storedEntries.find((e) => e.key === "completion-status");
    expect(statusEntry).toBeDefined();
    expect(statusEntry!.value).toEqual("installed");
    expect(infoMessage).toContain("Shell completion installed for zsh");
  });

  test("initService shows error when installation fails", async () => {
    const service = new DefaultCompletionService();
    service.validateShellEnvironment = () => Promise.resolve(true);
    const originalGetConfigPath = service.getDefaultConfigPath.bind(service);
    service.getDefaultConfigPath = () => {
      throw new Error("test error");
    };

    const provider = new CompletionServiceProvider(60, service, getCommandRegistry());
    await provider.getServiceInfo(getCLIConfig());

    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance("@flowscripter/dynamic-cli-framework/prompter-service", {
      promptEnabled: true,
      prompt: (promptDef: { name: string }) =>
        Promise.resolve({
          name: promptDef.name,
          value: promptDef.name === "enable-completion" ? true : "bash",
        }),
      promptAll: () => Promise.resolve([]),
    });
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/key-value-service", {
      hasKey: () => Promise.resolve(false),
      getKey: () => Promise.resolve(""),
      setKey: () => Promise.resolve(),
      deleteKey: () => Promise.resolve(),
    });

    let errorMessage = "";
    context.addServiceInstance("@flowscripter/dynamic-cli-framework/printer-service", {
      info: () => Promise.resolve(),
      warn: () => Promise.resolve(),
      error: (msg: string) => {
        errorMessage = msg;
        return Promise.resolve();
      },
      print: () => Promise.resolve(),
    });

    await provider.initService(context);
    expect(errorMessage).toContain("Failed to install completion");
    expect(errorMessage).toContain("test error");

    service.getDefaultConfigPath = originalGetConfigPath;
  });
});
