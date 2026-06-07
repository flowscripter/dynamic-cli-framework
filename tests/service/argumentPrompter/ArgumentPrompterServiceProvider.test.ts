import { describe, expect, test } from "bun:test";
import ArgumentPrompterServiceProvider from "../../../src/service/argumentPrompter/ArgumentPrompterServiceProvider.ts";
import { ARGUMENT_PROMPTER_SERVICE_ID } from "../../../src/api/service/core/ArgumentPrompterService.ts";
import type ArgumentPrompterService from "../../../src/api/service/core/ArgumentPrompterService.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

function getMockArgumentPrompterService(): ArgumentPrompterService {
  return {
    promptForMissingArguments: (parseResult) => Promise.resolve(parseResult),
  };
}

describe("ArgumentPrompterServiceProvider tests", () => {
  test("ArgumentPrompterServiceProvider has correct serviceId", () => {
    const provider = new ArgumentPrompterServiceProvider(100, getMockArgumentPrompterService());

    expect(provider.serviceId).toEqual(ARGUMENT_PROMPTER_SERVICE_ID);
  });

  test("ArgumentPrompterServiceProvider getServiceInfo returns no commands", async () => {
    const argPrompterService = getMockArgumentPrompterService();
    const provider = new ArgumentPrompterServiceProvider(100, argPrompterService);
    const cliConfig = getCLIConfig();

    const serviceInfo = await provider.getServiceInfo(cliConfig);

    expect(serviceInfo.service).toBe(argPrompterService);
    expect(serviceInfo.commands.length).toEqual(0);
  });

  test("ArgumentPrompterServiceProvider initService resolves", async () => {
    const provider = new ArgumentPrompterServiceProvider(100, getMockArgumentPrompterService());
    const context = new DefaultContext(getCLIConfig());

    await expect(provider.initService(context)).resolves.toBeUndefined();
  });
});
