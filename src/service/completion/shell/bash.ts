import process from "node:process";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CompletionItem } from "../../../api/service/core/CompletionService.ts";
import type ShellHandler from "./ShellHandler.ts";
import type { CompletionContext } from "./ShellHandler.ts";

// Reference: https://www.gnu.org/software/bash/manual/html_node/Programmable-Completion.html

export default class BashShellHandler implements ShellHandler {
  getDefaultConfigPath(): string {
    return join(homedir(), ".bashrc");
  }

  getBootstrapScript(cliName: string, executablePath: string): string {
    return [
      `_${cliName}_completions() {`,
      `  local IFS=$'\\n'`,
      `  COMPREPLY=( $("${executablePath}" completions:complete bash "\${COMP_LINE}" "\${COMP_POINT}") )`,
      `}`,
      `complete -F _${cliName}_completions ${cliName}`,
    ].join("\n");
  }

  validateEnvironment(): Promise<boolean> {
    const shell = process.env.SHELL || "";
    if (shell.endsWith("/bash")) {
      return Promise.resolve(true);
    }
    try {
      const result = Bun.spawnSync(["bash", "--version"]);
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
