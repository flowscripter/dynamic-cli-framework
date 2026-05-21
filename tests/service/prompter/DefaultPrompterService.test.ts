import { describe, expect, test } from "bun:test";
import DefaultPrompterService, {
  DEFAULT_PROMPTER_CONFIG,
} from "../../../src/service/prompter/DefaultPrompterService.ts";
import type KeyReader from "../../../src/terminal/KeyReader.ts";
import { type KeyEvent, SpecialKey } from "../../../src/terminal/KeyReader.ts";
import type Terminal from "../../../src/terminal/Terminal.ts";
import { PromptType } from "../../../src/api/service/core/PrompterService.ts";
import type PrinterService from "../../../src/api/service/core/PrinterService.ts";

class MockKeyReader implements KeyReader {
  #keys: KeyEvent[] = [];

  enableRawMode() {}
  disableRawMode() {}

  addKeys(...keys: KeyEvent[]) {
    this.#keys.push(...keys);
  }

  readKey(): Promise<KeyEvent> {
    const key = this.#keys.shift();
    if (!key) throw new Error("No more keys");
    return Promise.resolve(key);
  }
}

class MockTerminal implements Terminal {
  buffer = "";
  clearUpLinesCalls: number[] = [];
  hideCursorCalled = false;
  showCursorCalled = false;

  clearLine(): Promise<void> {
    return Promise.resolve();
  }

  clearUpLines(count: number): Promise<void> {
    this.clearUpLinesCalls.push(count);
    return Promise.resolve();
  }

  hideCursor(): Promise<void> {
    this.hideCursorCalled = true;
    return Promise.resolve();
  }

  showCursor(): Promise<void> {
    this.showCursorCalled = true;
    return Promise.resolve();
  }

  write(text: string): Promise<void> {
    this.buffer += text;
    return Promise.resolve();
  }

  columns(): number {
    return 80;
  }

  rows(): number {
    return 24;
  }
}

function getMockPrinterService(): PrinterService {
  return {
    colorEnabled: false,
    hyperlinksEnabled: false,
    darkMode: false,
    stdoutWritable: new WritableStream(),
    stderrWritable: new WritableStream(),
    primary: (m: string) => m,
    secondary: (m: string) => m,
    emphasised: (m: string) => m,
    selected: (m: string) => m,
    italic: (m: string) => m,
    yellow: (m: string) => m,
    orange: (m: string) => m,
    red: (m: string) => m,
    magenta: (m: string) => m,
    violet: (m: string) => m,
    blue: (m: string) => m,
    cyan: (m: string) => m,
    green: (m: string) => m,
    color: (m: string, _c: string) => m,
    backgroundPrimary: (m: string) => m,
    backgroundSecondary: (m: string) => m,
    backgroundEmphasised: (m: string) => m,
    backgroundSelected: (m: string) => m,
    backgroundYellow: (m: string) => m,
    backgroundOrange: (m: string) => m,
    backgroundRed: (m: string) => m,
    backgroundMagenta: (m: string) => m,
    backgroundViolet: (m: string) => m,
    backgroundBlue: (m: string) => m,
    backgroundCyan: (m: string) => m,
    backgroundGreen: (m: string) => m,
    backgroundColor: (m: string, _c: string) => m,
    hyperlink: (t: string, _u: string) => t,
    stdoutColumns: () => 80,
    stderrColumns: () => 80,
    print: () => Promise.resolve(),
    debug: () => Promise.resolve(),
    info: () => Promise.resolve(),
    warn: () => Promise.resolve(),
    error: () => Promise.resolve(),
    setLevel: () => {},
    getLevel: () => 1,
    showSpinner: () => Promise.resolve(),
    hideSpinner: () => Promise.resolve(),
    showProgressBar: () => Promise.resolve(0),
    hideProgressBar: () => Promise.resolve(),
    hideAllProgressBars: () => Promise.resolve(),
    updateProgressBar: () => {},
  } as PrinterService;
}

function createService(keyReader: MockKeyReader): {
  service: DefaultPrompterService;
  terminal: MockTerminal;
} {
  const terminal = new MockTerminal();
  const service = new DefaultPrompterService(
    DEFAULT_PROMPTER_CONFIG,
    terminal,
    keyReader,
    getMockPrinterService(),
  );
  return { service, terminal };
}

describe("DefaultPrompterService tests", () => {
  test("SINGLE_SELECT selects correct option", async () => {
    const keyReader = new MockKeyReader();
    keyReader.addKeys(
      { specialKey: SpecialKey.DOWN },
      { specialKey: SpecialKey.ENTER },
    );
    const { service } = createService(keyReader);

    const result = await service.prompt({
      name: "test",
      promptText: "Pick one",
      type: PromptType.SINGLE_SELECT,
      options: [
        { displayValue: "Option A", returnedValue: "a" },
        { displayValue: "Option B", returnedValue: "b" },
        { displayValue: "Option C", returnedValue: "c" },
      ],
    });

    expect(result.name).toEqual("test");
    expect(result.value).toEqual("b");
  });

  test("MULTI_SELECT selects correct options", async () => {
    const keyReader = new MockKeyReader();
    keyReader.addKeys(
      { specialKey: SpecialKey.SPACE },
      { specialKey: SpecialKey.DOWN },
      { specialKey: SpecialKey.SPACE },
      { specialKey: SpecialKey.ENTER },
    );
    const { service } = createService(keyReader);

    const result = await service.prompt({
      name: "test",
      promptText: "Pick many",
      type: PromptType.MULTI_SELECT,
      options: [
        { displayValue: "Option A", returnedValue: "a" },
        { displayValue: "Option B", returnedValue: "b" },
        { displayValue: "Option C", returnedValue: "c" },
      ],
    });

    expect(result.name).toEqual("test");
    expect(result.value).toEqual(["a", "b"]);
  });

  test("ACKNOWLEDGE selects Yes when navigated to", async () => {
    const keyReader = new MockKeyReader();
    keyReader.addKeys(
      { specialKey: SpecialKey.UP },
      { specialKey: SpecialKey.ENTER },
    );
    const { service } = createService(keyReader);

    const result = await service.prompt({
      name: "test",
      promptText: "Confirm?",
      type: PromptType.ACKNOWLEDGE,
      options: [],
    });

    expect(result.name).toEqual("test");
    expect(result.value).toEqual(true);
  });

  test("TOGGLE selects False", async () => {
    const keyReader = new MockKeyReader();
    keyReader.addKeys(
      { specialKey: SpecialKey.DOWN },
      { specialKey: SpecialKey.ENTER },
    );
    const { service } = createService(keyReader);

    const result = await service.prompt({
      name: "test",
      promptText: "Toggle?",
      type: PromptType.TOGGLE,
      options: [],
    });

    expect(result.name).toEqual("test");
    expect(result.value).toEqual(false);
  });

  test("TEXT captures typed characters", async () => {
    const keyReader = new MockKeyReader();
    keyReader.addKeys(
      { key: "h" },
      { key: "i" },
      { specialKey: SpecialKey.ENTER },
    );
    const { service } = createService(keyReader);

    const result = await service.prompt({
      name: "test",
      promptText: "Enter text",
      type: PromptType.TEXT,
      options: [],
    });

    expect(result.name).toEqual("test");
    expect(result.value).toEqual("hi");
  });

  test("TEXT handles backspace", async () => {
    const keyReader = new MockKeyReader();
    keyReader.addKeys(
      { key: "h" },
      { key: "i" },
      { specialKey: SpecialKey.BACKSPACE },
      { key: "o" },
      { specialKey: SpecialKey.ENTER },
    );
    const { service } = createService(keyReader);

    const result = await service.prompt({
      name: "test",
      promptText: "Enter text",
      type: PromptType.TEXT,
      options: [],
    });

    expect(result.name).toEqual("test");
    expect(result.value).toEqual("ho");
  });

  test("promptEnabled=false with default returns default value", async () => {
    const keyReader = new MockKeyReader();
    const { service } = createService(keyReader);
    service.promptEnabled = false;

    const result = await service.prompt({
      name: "test",
      promptText: "Pick one",
      type: PromptType.SINGLE_SELECT,
      defaultOption: { displayValue: "Default", returnedValue: "default_val" },
      options: [
        { displayValue: "Default", returnedValue: "default_val" },
        { displayValue: "Other", returnedValue: "other" },
      ],
    });

    expect(result.name).toEqual("test");
    expect(result.value).toEqual("default_val");
  });

  test("promptEnabled=false without default throws error", async () => {
    const keyReader = new MockKeyReader();
    const { service } = createService(keyReader);
    service.promptEnabled = false;

    await expect(
      service.prompt({
        name: "test",
        promptText: "Pick one",
        type: PromptType.SINGLE_SELECT,
        options: [
          { displayValue: "A", returnedValue: "a" },
        ],
      }),
    ).rejects.toThrow("Prompting is disabled and no default for prompt: test");
  });

  test("ESCAPE cancels prompt", async () => {
    const keyReader = new MockKeyReader();
    keyReader.addKeys({ specialKey: SpecialKey.ESCAPE });
    const { service } = createService(keyReader);

    await expect(
      service.prompt({
        name: "test",
        promptText: "Pick one",
        type: PromptType.SINGLE_SELECT,
        options: [
          { displayValue: "A", returnedValue: "a" },
        ],
      }),
    ).rejects.toThrow("Prompt cancelled");
  });

  test("promptAll runs multiple prompts sequentially", async () => {
    const keyReader = new MockKeyReader();
    keyReader.addKeys(
      { specialKey: SpecialKey.ENTER },
      { key: "x" },
      { specialKey: SpecialKey.ENTER },
    );
    const { service } = createService(keyReader);

    const results = await service.promptAll([
      {
        name: "first",
        promptText: "Pick one",
        type: PromptType.SINGLE_SELECT,
        options: [
          { displayValue: "A", returnedValue: "a" },
          { displayValue: "B", returnedValue: "b" },
        ],
      },
      {
        name: "second",
        promptText: "Enter text",
        type: PromptType.TEXT,
        options: [],
      },
    ]);

    expect(results.length).toEqual(2);
    expect(results[0]!.name).toEqual("first");
    expect(results[0]!.value).toEqual("a");
    expect(results[1]!.name).toEqual("second");
    expect(results[1]!.value).toEqual("x");
  });
});
