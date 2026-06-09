import { describe, expect, test } from "bun:test";
import { physicalLineCount } from "../../../../src/service/prompter/prompt/PromptContext.ts";
import type Terminal from "../../../../src/terminal/Terminal.ts";

class MockTerminal implements Terminal {
  readonly #cols: number;
  constructor(cols: number) {
    this.#cols = cols;
  }
  columns(): number {
    return this.#cols;
  }
  rows(): number {
    return 24;
  }
  clearLine(): Promise<void> {
    return Promise.resolve();
  }
  clearUpLines(): Promise<void> {
    return Promise.resolve();
  }
  hideCursor(): Promise<void> {
    return Promise.resolve();
  }
  showCursor(): Promise<void> {
    return Promise.resolve();
  }
  write(): Promise<void> {
    return Promise.resolve();
  }
}

describe("physicalLineCount", () => {
  test("single short text fits on one line", () => {
    expect(physicalLineCount(new MockTerminal(80), "hello")).toBe(1);
  });

  test("text wider than terminal wraps", () => {
    // 11 chars on a 10-col terminal => 2 lines
    expect(physicalLineCount(new MockTerminal(10), "hello world")).toBe(2);
  });

  test("embedded newline on wide terminal counts as two lines", () => {
    // Both parts fit on one line (terminal 300 cols > 127 and > 81),
    // but the embedded \n always forces 2 rendered lines
    const text =
      "This will set up your terminal so that pressing TAB while typing commands will show possible options and autocomplete arguments.\n(Enabling autocompletion will modify configuration files in your home directory.)";
    expect(physicalLineCount(new MockTerminal(300), text)).toBe(2);
  });

  test("embedded newline combined with wrapping", () => {
    // "hello world" (11 chars) => ceil(11/10) = 2 lines
    // "foo" (3 chars) => ceil(3/10) = 1 line
    // total = 3
    expect(physicalLineCount(new MockTerminal(10), "hello world\nfoo")).toBe(3);
  });

  test("zero columns returns 1", () => {
    expect(physicalLineCount(new MockTerminal(0), "hello")).toBe(1);
  });
});
