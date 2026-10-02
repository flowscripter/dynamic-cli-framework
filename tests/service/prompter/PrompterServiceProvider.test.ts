import { describe, expect, test } from "bun:test";
import PrompterServiceProvider from "../../../src/service/prompter/PrompterServiceProvider.ts";
import { PROMPTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultPrompterService, {
  DEFAULT_PROMPTER_CONFIG,
} from "../../../src/service/prompter/DefaultPrompterService.ts";
import type Terminal from "../../../src/terminal/Terminal.ts";
import type KeyReader from "../../../src/terminal/KeyReader.ts";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

function getMockPrompterService(): DefaultPrompterService {
  return new DefaultPrompterService(
    DEFAULT_PROMPTER_CONFIG,
    {} as Terminal,
    {} as KeyReader,
    {} as PrinterService,
  );
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

  test("PrompterServiceProvider initService passes the context to the service", async () => {
    const prompterService = getMockPrompterService();
    const contexts: unknown[] = [];
    prompterService.setContext = (context) => {
      contexts.push(context);
    };
    const provider = new PrompterServiceProvider(100, prompterService);
    const context = new DefaultContext(getCLIConfig());

    await expect(provider.initService(context)).resolves.toBeUndefined();
    expect(contexts).toEqual([context]);
  });

  test("PrompterServiceProvider initService accepts a non-default PrompterService", async () => {
    const provider = new PrompterServiceProvider(100, {
      promptEnabled: true,
      prompt: () => Promise.resolve({ name: "", value: "" }),
      promptAll: () => Promise.resolve([]),
    });
    const context = new DefaultContext(getCLIConfig());

    await expect(provider.initService(context)).resolves.toBeUndefined();
  });
});
