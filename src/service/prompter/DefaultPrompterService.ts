import type PrompterService from "../../api/service/core/PrompterService.ts";
import {
  type Prompt,
  type PromptResult,
  PromptType,
} from "../../api/service/core/PrompterService.ts";
import type { ArgumentSingleValueType } from "../../api/argument/ArgumentValueTypes.ts";
import type Terminal from "../../terminal/Terminal.ts";
import type KeyReader from "../../terminal/KeyReader.ts";
import { SpecialKey } from "../../terminal/KeyReader.ts";
import type PrinterService from "../../api/service/core/PrinterService.ts";

export interface PrompterServiceConfig {
  readonly inputPromptCharacters: string;
  readonly checkboxCheckedChars: string;
  readonly checkboxUncheckedChars: string;
  readonly scrollVisibleOptions: number;
}

export const DEFAULT_PROMPTER_CONFIG: PrompterServiceConfig = {
  inputPromptCharacters: "> ",
  checkboxCheckedChars: "[x]",
  checkboxUncheckedChars: "[ ]",
  scrollVisibleOptions: 8,
};

export default class DefaultPrompterService implements PrompterService {
  promptEnabled = true;

  readonly #config: PrompterServiceConfig;
  readonly #terminal: Terminal;
  readonly #keyReader: KeyReader;
  readonly #printerService: PrinterService;

  public constructor(
    config: PrompterServiceConfig,
    terminal: Terminal,
    keyReader: KeyReader,
    printerService: PrinterService,
  ) {
    this.#config = config;
    this.#terminal = terminal;
    this.#keyReader = keyReader;
    this.#printerService = printerService;
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
        new Error(
          `Prompting is disabled and no default for prompt: ${promptDef.name}`,
        ),
      );
    }

    switch (promptDef.type) {
      case PromptType.SINGLE_SELECT:
        return this.#promptSingleSelect(promptDef);
      case PromptType.MULTI_SELECT:
        return this.#promptMultiSelect(promptDef);
      case PromptType.ACKNOWLEDGE:
        return this.#promptAcknowledge(promptDef);
      case PromptType.TOGGLE:
        return this.#promptToggle(promptDef);
      case PromptType.TEXT:
        return this.#promptText(promptDef);
    }
  }

  async promptAll(
    prompts: ReadonlyArray<Prompt>,
  ): Promise<ReadonlyArray<PromptResult>> {
    const results: PromptResult[] = [];
    for (const p of prompts) {
      results.push(await this.prompt(p));
    }
    return results;
  }

  async #promptSingleSelect(promptDef: Prompt): Promise<PromptResult> {
    const options = promptDef.options;
    if (options.length === 0) {
      throw new Error(`No options for prompt: ${promptDef.name}`);
    }

    let selectedIndex = 0;
    if (promptDef.defaultOption) {
      const idx = options.findIndex(
        (o) => o.returnedValue === promptDef.defaultOption!.returnedValue,
      );
      if (idx >= 0) selectedIndex = idx;
    }

    let scrollOffset = 0;
    const visibleCount = Math.min(
      this.#config.scrollVisibleOptions,
      options.length,
    );

    this.#keyReader.enableRawMode();
    try {
      await this.#terminal.hideCursor();
      let firstRender = true;

      while (true) {
        if (scrollOffset > selectedIndex) {
          scrollOffset = selectedIndex;
        } else if (selectedIndex >= scrollOffset + visibleCount) {
          scrollOffset = selectedIndex - visibleCount + 1;
        }

        if (!firstRender) {
          await this.#terminal.clearUpLines(
            visibleCount + (promptDef.description ? 2 : 1),
          );
        }
        firstRender = false;

        await this.#renderPromptHeader(promptDef);

        for (let i = scrollOffset; i < scrollOffset + visibleCount; i++) {
          const option = options[i]!;
          const isSelected = i === selectedIndex;
          const prefix = isSelected ? this.#config.inputPromptCharacters : "  ";
          const text = prefix + option.displayValue;
          await this.#terminal.write(
            `${
              isSelected
                ? this.#printerService.cyan(text)
                : this.#printerService.secondary(text)
            }\n`,
          );
        }

        const keyEvent = await this.#keyReader.readKey();
        if (keyEvent.specialKey === SpecialKey.UP && selectedIndex > 0) {
          selectedIndex--;
        } else if (
          keyEvent.specialKey === SpecialKey.DOWN &&
          selectedIndex < options.length - 1
        ) {
          selectedIndex++;
        } else if (keyEvent.specialKey === SpecialKey.ENTER) {
          await this.#terminal.showCursor();
          const option = options[selectedIndex]!;
          const validationError = option.validate
            ? option.validate(option.returnedValue)
            : undefined;
          if (validationError) {
            await this.#terminal.write(
              `${this.#printerService.red(validationError)}\n`,
            );
            firstRender = true;
            continue;
          }
          return { name: promptDef.name, value: option.returnedValue };
        } else if (keyEvent.specialKey === SpecialKey.ESCAPE) {
          await this.#terminal.showCursor();
          throw new Error("Prompt cancelled");
        }
      }
    } finally {
      this.#keyReader.disableRawMode();
    }
  }

  async #promptMultiSelect(promptDef: Prompt): Promise<PromptResult> {
    const options = promptDef.options;
    if (options.length === 0) {
      throw new Error(`No options for prompt: ${promptDef.name}`);
    }

    let focusIndex = 0;
    const checked = new Set<number>();
    let scrollOffset = 0;
    const visibleCount = Math.min(
      this.#config.scrollVisibleOptions,
      options.length,
    );

    this.#keyReader.enableRawMode();
    try {
      await this.#terminal.hideCursor();
      let firstRender = true;

      while (true) {
        if (scrollOffset > focusIndex) {
          scrollOffset = focusIndex;
        } else if (focusIndex >= scrollOffset + visibleCount) {
          scrollOffset = focusIndex - visibleCount + 1;
        }

        if (!firstRender) {
          await this.#terminal.clearUpLines(
            visibleCount + (promptDef.description ? 2 : 1),
          );
        }
        firstRender = false;

        await this.#renderPromptHeader(promptDef);

        for (let i = scrollOffset; i < scrollOffset + visibleCount; i++) {
          const option = options[i]!;
          const isFocused = i === focusIndex;
          const isChecked = checked.has(i);
          const checkbox = isChecked
            ? this.#printerService.green(this.#config.checkboxCheckedChars)
            : this.#printerService.secondary(
              this.#config.checkboxUncheckedChars,
            );
          const text = option.displayValue;
          await this.#terminal.write(
            `${checkbox} ${
              isFocused
                ? this.#printerService.cyan(text)
                : this.#printerService.secondary(text)
            }\n`,
          );
        }

        const keyEvent = await this.#keyReader.readKey();
        if (keyEvent.specialKey === SpecialKey.UP && focusIndex > 0) {
          focusIndex--;
        } else if (
          keyEvent.specialKey === SpecialKey.DOWN &&
          focusIndex < options.length - 1
        ) {
          focusIndex++;
        } else if (keyEvent.specialKey === SpecialKey.SPACE) {
          if (checked.has(focusIndex)) {
            checked.delete(focusIndex);
          } else {
            checked.add(focusIndex);
          }
        } else if (keyEvent.specialKey === SpecialKey.ENTER) {
          await this.#terminal.showCursor();
          const values = [...checked].sort().map(
            (i) => options[i]!.returnedValue,
          );
          return { name: promptDef.name, value: values };
        } else if (keyEvent.specialKey === SpecialKey.ESCAPE) {
          await this.#terminal.showCursor();
          throw new Error("Prompt cancelled");
        }
      }
    } finally {
      this.#keyReader.disableRawMode();
    }
  }

  #promptAcknowledge(promptDef: Prompt): Promise<PromptResult> {
    const yesNo: Prompt = {
      name: promptDef.name,
      promptText: promptDef.promptText,
      description: promptDef.description,
      type: PromptType.SINGLE_SELECT,
      defaultOption: promptDef.defaultOption ?? {
        displayValue: "No",
        returnedValue: false,
      },
      options: [
        { displayValue: "Yes", returnedValue: true },
        { displayValue: "No", returnedValue: false },
      ],
    };
    return this.#promptSingleSelect(yesNo);
  }

  #promptToggle(promptDef: Prompt): Promise<PromptResult> {
    const trueFalse: Prompt = {
      name: promptDef.name,
      promptText: promptDef.promptText,
      description: promptDef.description,
      type: PromptType.SINGLE_SELECT,
      defaultOption: promptDef.defaultOption ?? {
        displayValue: "False",
        returnedValue: false,
      },
      options: [
        { displayValue: "True", returnedValue: true },
        { displayValue: "False", returnedValue: false },
      ],
    };
    return this.#promptSingleSelect(trueFalse);
  }

  async #promptText(promptDef: Prompt): Promise<PromptResult> {
    this.#keyReader.enableRawMode();
    try {
      while (true) {
        await this.#renderPromptHeader(promptDef);
        const promptMarker = this.#printerService.cyan(
          this.#config.inputPromptCharacters,
        );
        await this.#terminal.write(promptMarker);

        let buffer = promptDef.defaultOption
          ? String(promptDef.defaultOption.returnedValue)
          : "";
        if (buffer.length > 0) {
          await this.#terminal.write(buffer);
        }

        while (true) {
          const keyEvent = await this.#keyReader.readKey();

          if (keyEvent.specialKey === SpecialKey.ENTER) {
            await this.#terminal.write("\n");
            break;
          } else if (keyEvent.specialKey === SpecialKey.ESCAPE) {
            await this.#terminal.write("\n");
            throw new Error("Prompt cancelled");
          } else if (keyEvent.specialKey === SpecialKey.BACKSPACE) {
            if (buffer.length > 0) {
              buffer = buffer.slice(0, -1);
              await this.#terminal.write("\b \b");
            }
          } else if (keyEvent.key) {
            buffer += keyEvent.key;
            const isSecret = promptDef.options.length > 0 &&
              promptDef.options[0]!.displayValue === "__SECRET__";
            await this.#terminal.write(isSecret ? "*" : keyEvent.key);
          }
        }

        if (buffer.length === 0 && !promptDef.defaultOption) {
          await this.#terminal.write(
            this.#printerService.red("Value required\n"),
          );
          continue;
        }

        const value: ArgumentSingleValueType = buffer;

        const validationOption = promptDef.options.length > 0
          ? promptDef.options[0]
          : undefined;
        if (validationOption?.validate) {
          const error = validationOption.validate(value);
          if (error) {
            await this.#terminal.write(
              `${this.#printerService.red(error)}\n`,
            );
            continue;
          }
        }

        if (validationOption?.min !== undefined && typeof value === "string") {
          const num = Number(value);
          if (!isNaN(num) && num < validationOption.min) {
            await this.#terminal.write(
              this.#printerService.red(
                `Value must be at least ${validationOption.min}\n`,
              ),
            );
            continue;
          }
        }
        if (validationOption?.max !== undefined && typeof value === "string") {
          const num = Number(value);
          if (!isNaN(num) && num > validationOption.max) {
            await this.#terminal.write(
              this.#printerService.red(
                `Value must be at most ${validationOption.max}\n`,
              ),
            );
            continue;
          }
        }

        return { name: promptDef.name, value };
      }
    } finally {
      this.#keyReader.disableRawMode();
    }
  }

  async #renderPromptHeader(promptDef: Prompt): Promise<void> {
    await this.#terminal.write(
      `${this.#printerService.emphasised(promptDef.promptText)}\n`,
    );
    if (promptDef.description) {
      await this.#terminal.write(
        `${this.#printerService.secondary(promptDef.description)}\n`,
      );
    }
  }
}
