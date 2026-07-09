import type { Prompt } from "@flowscripter/dynamic-cli-framework-api";
import type Terminal from "../../../terminal/Terminal.ts";
import type KeyReader from "../../../terminal/KeyReader.ts";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import type { PrompterServiceConfig } from "../DefaultPrompterService.ts";

export interface PromptContext {
  readonly config: PrompterServiceConfig;
  readonly terminal: Terminal;
  readonly keyReader: KeyReader;
  readonly printerService: PrinterService;
}

export function physicalLineCount(terminal: Terminal, text: string): number {
  const cols = terminal.columns();
  if (cols <= 0) return 1;
  return text.split("\n").reduce((sum, segment) => {
    const width = Bun.stringWidth(segment);
    return sum + Math.max(1, Math.ceil(width / cols));
  }, 0);
}

export function headerLineCount(terminal: Terminal, promptDef: Prompt): number {
  let count = physicalLineCount(terminal, promptDef.promptText);
  if (promptDef.description) {
    count += physicalLineCount(terminal, promptDef.description);
  }
  return count;
}

export async function renderPromptHeader(ctx: PromptContext, promptDef: Prompt): Promise<void> {
  await ctx.terminal.write(`${ctx.printerService.emphasised(promptDef.promptText)}\n`);
  if (promptDef.description) {
    await ctx.terminal.write(`${ctx.printerService.secondary(promptDef.description)}\n`);
  }
}
