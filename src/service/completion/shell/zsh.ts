import process from "node:process";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CompletionItem } from "../../../api/service/core/CompletionService.ts";
import type ShellHandler from "./ShellHandler.ts";
import type { CompletionContext } from "./ShellHandler.ts";

// Reference: https://zsh.sourceforge.io/Doc/Release/Completion-System.html

export default class ZshShellHandler implements ShellHandler {
  getDefaultConfigPath(): string {
    return join(homedir(), ".zshrc");
  }

  getBootstrapScript(cliName: string): string {
    return [
      `_${cliName}_completions() {`,
      `  local -a completions`,
      `  completions=("\${(@f)$(${cliName} completions:complete zsh "\${words}" "\${CURSOR}")}")`,
      `  _describe '${cliName}' completions`,
      `}`,
      `compdef _${cliName}_completions ${cliName}`,
    ].join("\n");
  }

  validateEnvironment(): Promise<boolean> {
    const shell = process.env.SHELL || "";
    if (shell.endsWith("/zsh")) {
      return Promise.resolve(true);
    }
    try {
      const result = Bun.spawnSync(["zsh", "--version"]);
      return Promise.resolve(result.exitCode === 0);
    } catch {
      return Promise.resolve(false);
    }
  }

  formatCompletions(completions: ReadonlyArray<CompletionItem>): string {
    return completions
      .map((c) => (c.description ? `${c.value}:${c.description}` : c.value))
      .join("\n");
  }

  parseCompletionContext(args: ReadonlyArray<string>): CompletionContext {
    const line = args[0] || "";
    const cursorPosition = parseInt(args[1] || "0", 10) || line.length;
    return { line, cursorPosition };
  }
}
