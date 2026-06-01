import path from "node:path";
import { describe, expect, test } from "bun:test";
import FishShellHandler from "../../../../src/service/completion/shell/fish.ts";

describe("FishShellHandler", () => {
  const handler = new FishShellHandler();

  test("getDefaultConfigPath returns fish config.fish", () => {
    const configPath = handler.getDefaultConfigPath();
    expect(configPath).toEndWith(
      path.sep + path.join(".config", "fish", "config.fish"),
    );
  });

  test("getBootstrapScript generates correct complete command", () => {
    const script = handler.getBootstrapScript("mycli");
    expect(script).toContain("complete -c mycli");
    expect(script).toContain("mycli completions:complete fish");
    expect(script).toContain("commandline -cp");
    expect(script).toContain("commandline -C");
  });

  test("formatCompletions uses tab separator for descriptions", () => {
    const result = handler.formatCompletions([
      { value: "help", description: "Display help" },
      { value: "version" },
    ]);
    expect(result).toEqual("help\tDisplay help\nversion");
  });

  test("parseCompletionContext extracts line and cursor position", () => {
    const ctx = handler.parseCompletionContext(["mycli he", "8"]);
    expect(ctx.line).toEqual("mycli he");
    expect(ctx.cursorPosition).toEqual(8);
  });
});
