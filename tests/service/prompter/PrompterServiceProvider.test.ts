import { describe, expect, test } from "bun:test";
import PrompterServiceProvider from "../../../src/service/prompter/PrompterServiceProvider.ts";
import { PROMPTER_SERVICE_ID } from "../../../src/api/service/core/PrompterService.ts";
import type PrompterService from "../../../src/api/service/core/PrompterService.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

function getMockPrompterService(): PrompterService {
  return {
    promptEnabled: true,
    prompt: () => Promise.resolve({ name: "", value: "" }),
    promptAll: () => Promise.resolve([]),
  };
}

describe("PrompterServiceProvider tests", () => {
  test("PrompterServiceProvider has correct serviceId", () => {
    const provider = new PrompterServiceProvider(100, getMockPrompterService());

    expect(provider.serviceId).toEqual(PROMPTER_SERVICE_ID);
  });

  test("PrompterServiceProvider getServiceInfo returns service and one command", async () => {
    const prompterService = getMockPrompterService();
    const provider = new PrompterServiceProvider(100, prompterService);
    const cliConfig = getCLIConfig();

    const serviceInfo = await provider.getServiceInfo(cliConfig);

    expect(serviceInfo.service).toBe(prompterService);
    expect(serviceInfo.commands.length).toEqual(1);
    expect(serviceInfo.commands[0]!.name).toEqual("no-prompt");
  });

  test("PrompterServiceProvider initService resolves", async () => {
    const provider = new PrompterServiceProvider(100, getMockPrompterService());
    const context = new DefaultContext(getCLIConfig());

    await expect(provider.initService(context)).resolves.toBeUndefined();
  });
});
