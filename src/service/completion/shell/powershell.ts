import process from "node:process";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CompletionItem } from "../../../api/service/core/CompletionService.ts";
import type ShellHandler from "./ShellHandler.ts";
import type { CompletionContext } from "./ShellHandler.ts";

// Reference: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/register-argumentcompleter

export default class PowerShellShellHandler implements ShellHandler {
  getDefaultConfigPath(): string {
    if (process.platform === "win32") {
      return join(homedir(), "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1");
    }
    return join(homedir(), ".config", "powershell", "Microsoft.PowerShell_profile.ps1");
  }

  getBootstrapScript(cliName: string, executablePath: string): string {
    return [
      `Register-ArgumentCompleter -Native -CommandName ${cliName} -ScriptBlock {`,
      `  param($wordToComplete, $commandAst, $cursorPosition)`,
      `  $completions = & "${executablePath}" completions:complete powershell "$commandAst" "$cursorPosition" 2>$null`,
      `  $completions -split '\\n' | ForEach-Object {`,
      `    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)`,
      `  }`,
      `}`,
    ].join("\n");
  }

  validateEnvironment(): Promise<boolean> {
    try {
      const result = Bun.spawnSync(["pwsh", "--version"], { timeout: 2000 });
      if (result.exitCode === 0) {
        return Promise.resolve(true);
      }
    } catch {
      // try powershell fallback
    }
    try {
      const result = Bun.spawnSync(["powershell", "-Command", "echo ok"], {
        timeout: 2000,
      });
      return Promise.resolve(result.exitCode === 0);
    } catch {
      return Promise.resolve(false);
    }
  }

  formatCompletions(completions: ReadonlyArray<CompletionItem>): string {
    return completions.map((c) => c.value).join("\n");
  }

  parseCompletionContext(args: ReadonlyArray<string>): CompletionContext {
    const line = args[0] || "";
    const cursorPosition = parseInt(args[1] || "0", 10) || line.length;
    return { line, cursorPosition };
  }
}
