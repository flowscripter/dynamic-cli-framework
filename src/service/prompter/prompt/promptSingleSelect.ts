import type { Prompt, PromptResult } from "@flowscripter/dynamic-cli-framework-api";
import { SpecialKey } from "../../../terminal/KeyReader.ts";
import ShutdownServiceProvider from "../../shutdown/ShutdownServiceProvider.ts";
import { headerLineCount, renderPromptHeader } from "./PromptContext.ts";
import type { PromptContext } from "./PromptContext.ts";

export default async function promptSingleSelect(
  ctx: PromptContext,
  promptDef: Prompt,
): Promise<PromptResult> {
  const options = promptDef.options;
  if (options.length === 0) {
    throw new Error(`No options for prompt: ${promptDef.name}`);
  }

  let selectedIndex = 0;
  if (promptDef.defaultOption) {
    const idx = options.findIndex(
      (o) => o.returnedValue === promptDef.defaultOption!.returnedValue,
    );
    if (idx >= 0) selectedIndex = idx;
  }

  let scrollOffset = 0;
  const visibleCount = Math.min(ctx.config.scrollVisibleOptions, options.length);

  ctx.keyReader.enableRawMode();
  try {
    await ctx.terminal.hideCursor();
    let firstRender = true;

    while (true) {
      if (scrollOffset > selectedIndex) {
        scrollOffset = selectedIndex;
      } else if (selectedIndex >= scrollOffset + visibleCount) {
        scrollOffset = selectedIndex - visibleCount + 1;
      }

      const headerLines = headerLineCount(ctx.terminal, promptDef);

      if (!firstRender) {
        await ctx.terminal.clearUpLines(visibleCount + headerLines);
      }
      firstRender = false;

      await renderPromptHeader(ctx, promptDef);

      for (let i = scrollOffset; i < scrollOffset + visibleCount; i++) {
        const option = options[i]!;
        const isSelected = i === selectedIndex;
        const prefix = isSelected ? ctx.config.inputPromptCharacters : "  ";
        const text = prefix + option.displayValue;
        await ctx.terminal.write(
          `${isSelected ? ctx.printerService.cyan(text) : ctx.printerService.secondary(text)}\n`,
        );
      }

      const keyEvent = await ctx.keyReader.readKey();
      if (keyEvent.specialKey === SpecialKey.UP && selectedIndex > 0) {
        selectedIndex--;
      } else if (keyEvent.specialKey === SpecialKey.DOWN && selectedIndex < options.length - 1) {
        selectedIndex++;
      } else if (keyEvent.specialKey === SpecialKey.ENTER) {
        await ctx.terminal.showCursor();
        const option = options[selectedIndex]!;
        const validationError = option.validate ? option.validate(option.returnedValue) : undefined;
        if (validationError) {
          await ctx.terminal.write(`${ctx.printerService.red(validationError)}\n`);
          firstRender = true;
          continue;
        }
        return { name: promptDef.name, value: option.returnedValue };
      } else if (keyEvent.specialKey === SpecialKey.ESCAPE) {
        await ctx.terminal.showCursor();
        throw new Error("Prompt cancelled");
      } else if (keyEvent.specialKey === SpecialKey.INTERRUPT) {
        await ctx.terminal.showCursor();
        ShutdownServiceProvider.onInterrupt();
        throw new Error("Interrupted");
      }
    }
  } finally {
    ctx.keyReader.disableRawMode();
  }
}
