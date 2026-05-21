import { describe, expect, test } from "bun:test";
import PowerShellShellHandler from "../../../../src/service/completion/shell/powershell.ts";

describe("PowerShellShellHandler", () => {
  const handler = new PowerShellShellHandler();

  test("getDefaultConfigPath returns PowerShell profile path", () => {
    const path = handler.getDefaultConfigPath();
    expect(path).toContain("Microsoft.PowerShell_profile.ps1");
  });

  test("getBootstrapScript generates Register-ArgumentCompleter", () => {
    const script = handler.getBootstrapScript("mycli");
    expect(script).toContain("Register-ArgumentCompleter");
    expect(script).toContain("-Native");
    expect(script).toContain("-CommandName mycli");
    expect(script).toContain("mycli completions:complete powershell");
    expect(script).toContain("CompletionResult");
  });

  test("formatCompletions outputs one value per line", () => {
    const result = handler.formatCompletions([
      { value: "help", description: "Display help" },
      { value: "version" },
    ]);
    expect(result).toEqual("help\nversion");
  });

  test("parseCompletionContext extracts line and cursor position", () => {
    const ctx = handler.parseCompletionContext(["mycli he", "8"]);
    expect(ctx.line).toEqual("mycli he");
    expect(ctx.cursorPosition).toEqual(8);
  });
});
