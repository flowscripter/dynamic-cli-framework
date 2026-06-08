import type { Prompt, PromptResult } from "../../../api/service/core/PrompterService.ts";
import type { ArgumentSingleValueType } from "../../../api/argument/ArgumentValueTypes.ts";
import { SpecialKey } from "../../../terminal/KeyReader.ts";
import ShutdownServiceProvider from "../../shutdown/ShutdownServiceProvider.ts";
import { renderPromptHeader } from "./PromptContext.ts";
import type { PromptContext } from "./PromptContext.ts";

export default async function promptText(
  ctx: PromptContext,
  promptDef: Prompt,
): Promise<PromptResult> {
  ctx.keyReader.enableRawMode();
  try {
    while (true) {
      await renderPromptHeader(ctx, promptDef);
      const promptMarker = ctx.printerService.cyan(ctx.config.inputPromptCharacters);
      await ctx.terminal.write(promptMarker);

      let buffer = promptDef.defaultOption ? String(promptDef.defaultOption.returnedValue) : "";
      if (buffer.length > 0) {
        await ctx.terminal.write(buffer);
      }

      while (true) {
        const keyEvent = await ctx.keyReader.readKey();

        if (keyEvent.specialKey === SpecialKey.ENTER) {
          await ctx.terminal.write("\n");
          break;
        } else if (keyEvent.specialKey === SpecialKey.ESCAPE) {
          await ctx.terminal.write("\n");
          throw new Error("Prompt cancelled");
        } else if (keyEvent.specialKey === SpecialKey.INTERRUPT) {
          await ctx.terminal.write("\n");
          ShutdownServiceProvider.onInterrupt();
          throw new Error("Interrupted");
        } else if (keyEvent.specialKey === SpecialKey.BACKSPACE) {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            await ctx.terminal.write("\b \b");
          }
        } else if (keyEvent.key) {
          buffer += keyEvent.key;
          const isSecret =
            promptDef.options.length > 0 && promptDef.options[0]!.displayValue === "__SECRET__";
          await ctx.terminal.write(isSecret ? "*" : keyEvent.key);
        }
      }

      if (buffer.length === 0 && !promptDef.defaultOption) {
        await ctx.terminal.write(ctx.printerService.red("Value required\n"));
        continue;
      }

      const value: ArgumentSingleValueType = buffer;

      const validationOption = promptDef.options.length > 0 ? promptDef.options[0] : undefined;
      if (validationOption?.validate) {
        const error = validationOption.validate(value);
        if (error) {
          await ctx.terminal.write(`${ctx.printerService.red(error)}\n`);
          continue;
        }
      }

      if (validationOption?.min !== undefined && typeof value === "string") {
        const num = Number(value);
        if (!isNaN(num) && num < validationOption.min) {
          await ctx.terminal.write(
            ctx.printerService.red(`Value must be at least ${validationOption.min}\n`),
          );
          continue;
        }
      }
      if (validationOption?.max !== undefined && typeof value === "string") {
        const num = Number(value);
        if (!isNaN(num) && num > validationOption.max) {
          await ctx.terminal.write(
            ctx.printerService.red(`Value must be at most ${validationOption.max}\n`),
          );
          continue;
        }
      }

      return { name: promptDef.name, value };
    }
  } finally {
    ctx.keyReader.disableRawMode();
  }
}
