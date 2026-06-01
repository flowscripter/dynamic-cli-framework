import path from "node:path";
import { describe, expect, test } from "bun:test";
import ZshShellHandler from "../../../../src/service/completion/shell/zsh.ts";

describe("ZshShellHandler", () => {
  const handler = new ZshShellHandler();

  test("getDefaultConfigPath returns ~/.zshrc", () => {
    const configPath = handler.getDefaultConfigPath();
    expect(configPath).toEndWith(path.sep + ".zshrc");
  });

  test("getBootstrapScript generates correct function", () => {
    const script = handler.getBootstrapScript("mycli");
    expect(script).toContain("_mycli_completions()");
    expect(script).toContain("mycli completions:complete zsh");
    expect(script).toContain("compdef _mycli_completions mycli");
    expect(script).toContain("_describe");
  });

  test("formatCompletions includes descriptions with colon separator", () => {
    const result = handler.formatCompletions([
      { value: "help", description: "Display help" },
      { value: "version" },
    ]);
    expect(result).toEqual("help:Display help\nversion");
  });

  test("parseCompletionContext extracts line and cursor position", () => {
    const ctx = handler.parseCompletionContext(["mycli he", "8"]);
    expect(ctx.line).toEqual("mycli he");
    expect(ctx.cursorPosition).toEqual(8);
  });
});
