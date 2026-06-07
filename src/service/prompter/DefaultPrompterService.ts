import type PrompterService from "../../api/service/core/PrompterService.ts";
import {
  type Prompt,
  type PromptResult,
  PromptType,
} from "../../api/service/core/PrompterService.ts";
import type Terminal from "../../terminal/Terminal.ts";
import type KeyReader from "../../terminal/KeyReader.ts";
import type PrinterService from "../../api/service/core/PrinterService.ts";
import type { PromptContext } from "./prompt/PromptContext.ts";
import promptSingleSelect from "./prompt/promptSingleSelect.ts";
import promptMultiSelect from "./prompt/promptMultiSelect.ts";
import promptAcknowledge from "./prompt/promptAcknowledge.ts";
import promptToggle from "./prompt/promptToggle.ts";
import promptText from "./prompt/promptText.ts";
import promptOpenUrl from "./prompt/promptOpenUrl.ts";

export interface PrompterServiceConfig {
  readonly inputPromptCharacters: string;
  readonly checkboxCheckedChars: string;
  readonly checkboxUncheckedChars: string;
  readonly scrollVisibleOptions: number;
  readonly openUrl?: (url: string) => Promise<void>;
}

export const DEFAULT_PROMPTER_CONFIG: PrompterServiceConfig = {
  inputPromptCharacters: "> ",
  checkboxCheckedChars: "[x]",
  checkboxUncheckedChars: "[ ]",
  scrollVisibleOptions: 8,
};

export default class DefaultPrompterService implements PrompterService {
  promptEnabled = true;

  readonly #ctx: PromptContext;

  public constructor(
    config: PrompterServiceConfig,
    terminal: Terminal,
    keyReader: KeyReader,
    printerService: PrinterService,
  ) {
    this.#ctx = { config, terminal, keyReader, printerService };
  }

  prompt(promptDef: Prompt): Promise<PromptResult> {
    if (!this.promptEnabled) {
      if (promptDef.defaultOption) {
        return Promise.resolve({
          name: promptDef.name,
          value: promptDef.defaultOption.returnedValue,
        });
      }
      return Promise.reject(
        new Error(`Prompting is disabled and no default for prompt: ${promptDef.name}`),
      );
    }

    switch (promptDef.type) {
      case PromptType.SINGLE_SELECT:
        return promptSingleSelect(this.#ctx, promptDef);
      case PromptType.MULTI_SELECT:
        return promptMultiSelect(this.#ctx, promptDef);
      case PromptType.ACKNOWLEDGE:
        return promptAcknowledge(this.#ctx, promptDef);
      case PromptType.TOGGLE:
        return promptToggle(this.#ctx, promptDef);
      case PromptType.TEXT:
        return promptText(this.#ctx, promptDef);
      case PromptType.OPEN_URL:
        return promptOpenUrl(this.#ctx, promptDef);
    }
  }

  async promptAll(prompts: ReadonlyArray<Prompt>): Promise<ReadonlyArray<PromptResult>> {
    const results: PromptResult[] = [];
    for (const p of prompts) {
      results.push(await this.prompt(p));
    }
    return results;
  }
}
