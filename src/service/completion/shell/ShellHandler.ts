import type { CompletionItem } from "../../../api/service/core/CompletionService.ts";

export interface CompletionContext {
  readonly line: string;
  readonly cursorPosition: number;
}

export default interface ShellHandler {
  getDefaultConfigPath(): string;
  getBootstrapScript(cliName: string): string;
  validateEnvironment(): Promise<boolean>;
  formatCompletions(completions: ReadonlyArray<CompletionItem>): string;
  parseCompletionContext(
    args: ReadonlyArray<string>,
  ): CompletionContext;
}
