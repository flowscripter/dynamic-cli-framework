import process from "node:process";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import BashShellHandler from "../../../../src/service/completion/shell/bash.ts";

describe("BashShellHandler", () => {
  const handler = new BashShellHandler();

  test("getDefaultConfigPath returns ~/.bashrc", () => {
    const configPath = handler.getDefaultConfigPath();
    expect(configPath).toEndWith(path.sep + ".bashrc");
  });

  test("getBootstrapScript generates correct function", () => {
    const script = handler.getBootstrapScript("mycli");
    expect(script).toContain("_mycli_completions()");
    expect(script).toContain("COMPREPLY=");
    expect(script).toContain("mycli completions:complete bash");
    expect(script).toContain("COMP_LINE");
    expect(script).toContain("COMP_POINT");
    expect(script).toContain("complete -F _mycli_completions mycli");
  });

  test("formatCompletions outputs one value per line", () => {
    const result = handler.formatCompletions([
      { value: "help", description: "Display help" },
      { value: "version", description: "Show version" },
    ]);
    expect(result).toEqual("help\nversion");
  });

  test("formatCompletions handles empty list", () => {
    expect(handler.formatCompletions([])).toEqual("");
  });

  test("parseCompletionContext extracts line and cursor position", () => {
    const ctx = handler.parseCompletionContext(["mycli he", "8"]);
    expect(ctx.line).toEqual("mycli he");
    expect(ctx.cursorPosition).toEqual(8);
  });

  test("parseCompletionContext handles missing args", () => {
    const ctx = handler.parseCompletionContext([]);
    expect(ctx.line).toEqual("");
    expect(ctx.cursorPosition).toEqual(0);
  });

  describe("validateEnvironment", () => {
    const originalShell = process.env.SHELL;

    test("returns true when SHELL ends with /bash", async () => {
      process.env.SHELL = "/bin/bash";
      const result = await handler.validateEnvironment();
      expect(result).toBe(true);
      process.env.SHELL = originalShell;
    });

    test("falls back to spawning bash --version when SHELL is not bash", async () => {
      process.env.SHELL = "/bin/zsh";
      const result = await handler.validateEnvironment();
      // Result depends on whether bash is installed; just verify it returns a boolean
      expect(typeof result).toBe("boolean");
      process.env.SHELL = originalShell;
    });

    test("falls back to spawning bash --version when SHELL is empty", async () => {
      process.env.SHELL = "";
      const result = await handler.validateEnvironment();
      expect(typeof result).toBe("boolean");
      process.env.SHELL = originalShell;
    });
  });
});
