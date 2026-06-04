import type { Prompt } from "../../../api/service/core/PrompterService.ts";
import type Terminal from "../../../terminal/Terminal.ts";
import type KeyReader from "../../../terminal/KeyReader.ts";
import type PrinterService from "../../../api/service/core/PrinterService.ts";
import type { PrompterServiceConfig } from "../DefaultPrompterService.ts";

export interface PromptContext {
  readonly config: PrompterServiceConfig;
  readonly terminal: Terminal;
  readonly keyReader: KeyReader;
  readonly printerService: PrinterService;
}

export function physicalLineCount(
  terminal: Terminal,
  text: string,
): number {
  const cols = terminal.columns();
  if (cols <= 0) return 1;
  const width = Bun.stringWidth(text);
  return Math.max(1, Math.ceil(width / cols));
}

export function headerLineCount(
  terminal: Terminal,
  promptDef: Prompt,
): number {
  let count = physicalLineCount(terminal, promptDef.promptText);
  if (promptDef.description) {
    count += physicalLineCount(terminal, promptDef.description);
  }
  return count;
}

export async function renderPromptHeader(
  ctx: PromptContext,
  promptDef: Prompt,
): Promise<void> {
  await ctx.terminal.write(
    `${ctx.printerService.emphasised(promptDef.promptText)}\n`,
  );
  if (promptDef.description) {
    await ctx.terminal.write(
      `${ctx.printerService.secondary(promptDef.description)}\n`,
    );
  }
}
