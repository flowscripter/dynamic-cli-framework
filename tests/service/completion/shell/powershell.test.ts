import process from "node:process";
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

  describe("validateEnvironment", () => {
    test("returns a boolean", async () => {
      // validateEnvironment tries pwsh first, then powershell fallback
      // Result depends on whether either is installed
      const result = await handler.validateEnvironment();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getDefaultConfigPath platform handling", () => {
    test("path contains Microsoft.PowerShell_profile.ps1", () => {
      const configPath = handler.getDefaultConfigPath();
      expect(configPath).toContain("Microsoft.PowerShell_profile.ps1");
      // On non-win32 platforms, path should contain .config/powershell
      if (process.platform !== "win32") {
        expect(configPath).toContain(".config");
        expect(configPath).toContain("powershell");
      } else {
        expect(configPath).toContain("Documents");
        expect(configPath).toContain("PowerShell");
      }
    });
  });
});
