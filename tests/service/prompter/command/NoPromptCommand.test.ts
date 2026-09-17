import { describe, expect, test } from "bun:test";
import NoPromptCommand from "../../../../src/service/prompter/command/NoPromptCommand.ts";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import { PROMPTER_SERVICE_ID, ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { PrompterService } from "@flowscripter/dynamic-cli-framework-api";

function getMockPrompterService(): PrompterService {
  return {
    promptEnabled: true,
    prompt: () => Promise.resolve({ name: "", value: "" }),
    promptAll: () => Promise.resolve([]),
  };
}

function getContext(prompterService: PrompterService): DefaultContext {
  const context = new DefaultContext(getCLIConfig());
  context.addServiceInstance(PROMPTER_SERVICE_ID, prompterService);
  return context;
}

describe("NoPromptCommand tests", () => {
  test("NoPromptCommand has correct properties", () => {
    const command = new NoPromptCommand(100);

    expect(command.name).toEqual("no-prompt");
    expect(command.description).toEqual("Disable interactive prompting");
    expect(command.enableConfiguration).toBeTrue();
    expect(command.executePriority).toEqual(100);
  });

  test("NoPromptCommand has correct argument", () => {
    const command = new NoPromptCommand(100);

    expect(command.argument.type).toEqual(ValueTypeName.BOOLEAN);
    expect(command.argument.defaultValue).toEqual(false);
    expect(command.argument.configurationKey).toEqual("NO_PROMPT");
  });

  test("NoPromptCommand execute with true disables prompting", async () => {
    const prompterService = getMockPrompterService();
    const context = getContext(prompterService);
    const command = new NoPromptCommand(100);

    await command.execute(context, true);

    expect(prompterService.promptEnabled).toBeFalse();
  });

  test("NoPromptCommand execute with false enables prompting", async () => {
    const prompterService = getMockPrompterService();
    prompterService.promptEnabled = false;
    const context = getContext(prompterService);
    const command = new NoPromptCommand(100);

    await command.execute(context, false);

    expect(prompterService.promptEnabled).toBeTrue();
  });
});
