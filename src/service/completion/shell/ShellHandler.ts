import type { CompletionItem } from "@flowscripter/dynamic-cli-framework-api";

export interface CompletionContext {
  readonly line: string;
  readonly cursorPosition: number;
}

export default interface ShellHandler {
  getDefaultConfigPath(): string;
  getBootstrapScript(cliName: string, executablePath: string): string;
  validateEnvironment(): Promise<boolean>;
  formatCompletions(completions: ReadonlyArray<CompletionItem>): string;
  parseCompletionContext(args: ReadonlyArray<string>): CompletionContext;
}
