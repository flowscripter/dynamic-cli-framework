import process from "node:process";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CompletionItem } from "../../../api/service/core/CompletionService.ts";
import type ShellHandler from "./ShellHandler.ts";
import type { CompletionContext } from "./ShellHandler.ts";

// Reference: https://fishshell.com/docs/current/completions.html

export default class FishShellHandler implements ShellHandler {
  getDefaultConfigPath(): string {
    return join(homedir(), ".config", "fish", "config.fish");
  }

  getBootstrapScript(cliName: string, executablePath: string): string {
    return `complete -c ${cliName} -f -a '("${executablePath}" completions:complete fish (commandline -cp) (commandline -C) 2>/dev/null)'`;
  }

  validateEnvironment(): Promise<boolean> {
    const shell = process.env.SHELL || "";
    if (shell.endsWith("/fish")) {
      return Promise.resolve(true);
    }
    try {
      const result = Bun.spawnSync(["fish", "--version"]);
      return Promise.resolve(result.exitCode === 0);
    } catch {
      return Promise.resolve(false);
    }
  }

  formatCompletions(completions: ReadonlyArray<CompletionItem>): string {
    return completions
      .map((c) => (c.description ? `${c.value}\t${c.description}` : c.value))
      .join("\n");
  }

  parseCompletionContext(args: ReadonlyArray<string>): CompletionContext {
    const line = args[0] || "";
    const cursorPosition = parseInt(args[1] || "0", 10) || line.length;
    return { line, cursorPosition };
  }
}
