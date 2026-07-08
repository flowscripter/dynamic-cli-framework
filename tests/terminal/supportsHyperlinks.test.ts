import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import supportsHyperlinks from "../../src/terminal/supportsHyperlinks.ts";
import type { WriteStream } from "node:tty";

const envKeys = [
  "CI",
  "CURSOR_TRACE_ID",
  "FORCE_HYPERLINK",
  "LC_TERMINAL",
  "LC_TERMINAL_VERSION",
  "TEAMCITY_VERSION",
  "TERM_PROGRAM",
  "TERM_PROGRAM_VERSION",
  "VTE_VERSION",
  "TERM",
  "WT_SESSION",
];

let savedEnv: Record<string, string | undefined>;

function ttyStream(): WriteStream {
  return { isTTY: true } as WriteStream;
}

function nonTtyStream(): WriteStream {
  return { isTTY: false } as WriteStream;
}

beforeEach(() => {
  savedEnv = {};
  for (const key of envKeys) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

describe("supportsHyperlinks", () => {
  test("returns false for non-TTY stream", () => {
    expect(supportsHyperlinks(nonTtyStream())).toBe(false);
  });

  test("returns false for unknown terminal", () => {
    expect(supportsHyperlinks(ttyStream())).toBe(false);
  });

  test("FORCE_HYPERLINK=1 overrides to true", () => {
    process.env.FORCE_HYPERLINK = "1";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("FORCE_HYPERLINK=0 overrides to false", () => {
    process.env.FORCE_HYPERLINK = "0";
    expect(supportsHyperlinks(ttyStream())).toBe(false);
  });

  test("FORCE_HYPERLINK=1 works even for non-TTY", () => {
    process.env.FORCE_HYPERLINK = "1";
    expect(supportsHyperlinks(nonTtyStream())).toBe(true);
  });

  test("returns true for Windows Terminal", () => {
    process.env.WT_SESSION = "some-session-id";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("returns true for iTerm.app >= 3.1", () => {
    process.env.TERM_PROGRAM = "iTerm.app";
    process.env.TERM_PROGRAM_VERSION = "3.1.0";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("returns false for iTerm.app < 3.1", () => {
    process.env.TERM_PROGRAM = "iTerm.app";
    process.env.TERM_PROGRAM_VERSION = "3.0.0";
    expect(supportsHyperlinks(ttyStream())).toBe(false);
  });

  test("returns true for vscode >= 1.72", () => {
    process.env.TERM_PROGRAM = "vscode";
    process.env.TERM_PROGRAM_VERSION = "1.72.0";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("returns false for vscode < 1.72", () => {
    process.env.TERM_PROGRAM = "vscode";
    process.env.TERM_PROGRAM_VERSION = "1.71.0";
    expect(supportsHyperlinks(ttyStream())).toBe(false);
  });

  test("returns true for Cursor (vscode + CURSOR_TRACE_ID)", () => {
    process.env.TERM_PROGRAM = "vscode";
    process.env.CURSOR_TRACE_ID = "some-id";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("returns true for ghostty", () => {
    process.env.TERM_PROGRAM = "ghostty";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("returns true for zed", () => {
    process.env.TERM_PROGRAM = "zed";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("returns true for WezTerm", () => {
    process.env.TERM_PROGRAM = "WezTerm";
    process.env.TERM_PROGRAM_VERSION = "20200620";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("returns true for VTE >= 0.50 (excluding 0.50.0)", () => {
    process.env.VTE_VERSION = "0.50.1";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("returns false for VTE 0.50.0 (segfault bug)", () => {
    process.env.VTE_VERSION = "0.50.0";
    expect(supportsHyperlinks(ttyStream())).toBe(false);
  });

  test("returns true for alacritty", () => {
    process.env.TERM = "alacritty";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("returns true for xterm-kitty", () => {
    process.env.TERM = "xterm-kitty";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("returns true for iTerm2 via LC_TERMINAL >= 3.1 (SSH forwarded)", () => {
    process.env.LC_TERMINAL = "iTerm2";
    process.env.LC_TERMINAL_VERSION = "3.1.0";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("returns false for iTerm2 via LC_TERMINAL < 3.1", () => {
    process.env.LC_TERMINAL = "iTerm2";
    process.env.LC_TERMINAL_VERSION = "3.0.0";
    expect(supportsHyperlinks(ttyStream())).toBe(false);
  });

  test("returns true for WezTerm via LC_TERMINAL", () => {
    process.env.LC_TERMINAL = "WezTerm";
    process.env.LC_TERMINAL_VERSION = "20200620";
    expect(supportsHyperlinks(ttyStream())).toBe(true);
  });

  test("returns false in CI", () => {
    process.env.CI = "true";
    expect(supportsHyperlinks(ttyStream())).toBe(false);
  });

  test("returns false for TeamCity", () => {
    process.env.TEAMCITY_VERSION = "2023.1";
    expect(supportsHyperlinks(ttyStream())).toBe(false);
  });
});
