import { describe, expect, test } from "bun:test";
import BashShellHandler from "../../../../src/service/completion/shell/bash.ts";

describe("BashShellHandler", () => {
  const handler = new BashShellHandler();

  test("getDefaultConfigPath returns ~/.bashrc", () => {
    const path = handler.getDefaultConfigPath();
    expect(path).toEndWith("/.bashrc");
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
});
