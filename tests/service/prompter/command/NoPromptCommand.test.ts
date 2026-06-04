import { describe, expect, test } from "bun:test";
import NoPromptCommand from "../../../../src/service/prompter/command/NoPromptCommand.ts";
import PrompterServiceProvider from "../../../../src/service/prompter/PrompterServiceProvider.ts";
import { ArgumentValueTypeName } from "../../../../src/api/argument/ArgumentValueTypes.ts";
import type PrompterService from "../../../../src/api/service/core/PrompterService.ts";
import type Context from "../../../../src/api/Context.ts";

function getMockPrompterService(): PrompterService {
  return {
    promptEnabled: true,
    prompt: () => Promise.resolve({ name: "", value: "" }),
    promptAll: () => Promise.resolve([]),
  };
}

describe("NoPromptCommand tests", () => {
  test("NoPromptCommand has correct properties", () => {
    const prompterService = getMockPrompterService();
    const provider = new PrompterServiceProvider(100, prompterService);
    const command = new NoPromptCommand(provider, 100);

    expect(command.name).toEqual("no-prompt");
    expect(command.description).toEqual("Disable interactive prompting");
    expect(command.enableConfiguration).toBeTrue();
    expect(command.executePriority).toEqual(100);
  });

  test("NoPromptCommand has correct argument", () => {
    const prompterService = getMockPrompterService();
    const provider = new PrompterServiceProvider(100, prompterService);
    const command = new NoPromptCommand(provider, 100);

    expect(command.argument.type).toEqual(ArgumentValueTypeName.BOOLEAN);
    expect(command.argument.defaultValue).toEqual(false);
    expect(command.argument.configurationKey).toEqual("NO_PROMPT");
  });

  test("NoPromptCommand execute with true disables prompting", async () => {
    const prompterService = getMockPrompterService();
    const provider = new PrompterServiceProvider(100, prompterService);
    const command = new NoPromptCommand(provider, 100);

    await command.execute({} as Context, true);

    expect(provider.prompterService.promptEnabled).toBeFalse();
  });

  test("NoPromptCommand execute with false enables prompting", async () => {
    const prompterService = getMockPrompterService();
    prompterService.promptEnabled = false;
    const provider = new PrompterServiceProvider(100, prompterService);
    const command = new NoPromptCommand(provider, 100);

    await command.execute({} as Context, false);

    expect(provider.prompterService.promptEnabled).toBeTrue();
  });
});
