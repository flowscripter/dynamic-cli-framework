import type { Prompt, PromptResult } from "../../../api/service/core/PrompterService.ts";
import { SpecialKey } from "../../../terminal/KeyReader.ts";
import ShutdownServiceProvider from "../../shutdown/ShutdownServiceProvider.ts";
import { headerLineCount, renderPromptHeader } from "./PromptContext.ts";
import type { PromptContext } from "./PromptContext.ts";

export default async function promptMultiSelect(
  ctx: PromptContext,
  promptDef: Prompt,
): Promise<PromptResult> {
  const options = promptDef.options;
  if (options.length === 0) {
    throw new Error(`No options for prompt: ${promptDef.name}`);
  }

  let focusIndex = 0;
  const checked = new Set<number>();
  let scrollOffset = 0;
  const visibleCount = Math.min(ctx.config.scrollVisibleOptions, options.length);

  ctx.keyReader.enableRawMode();
  try {
    await ctx.terminal.hideCursor();
    let firstRender = true;

    while (true) {
      if (scrollOffset > focusIndex) {
        scrollOffset = focusIndex;
      } else if (focusIndex >= scrollOffset + visibleCount) {
        scrollOffset = focusIndex - visibleCount + 1;
      }

      const headerLines = headerLineCount(ctx.terminal, promptDef);

      if (!firstRender) {
        await ctx.terminal.clearUpLines(visibleCount + headerLines);
      }
      firstRender = false;

      await renderPromptHeader(ctx, promptDef);

      for (let i = scrollOffset; i < scrollOffset + visibleCount; i++) {
        const option = options[i]!;
        const isFocused = i === focusIndex;
        const isChecked = checked.has(i);
        const checkbox = isChecked
          ? ctx.printerService.green(ctx.config.checkboxCheckedChars)
          : ctx.printerService.secondary(ctx.config.checkboxUncheckedChars);
        const text = option.displayValue;
        await ctx.terminal.write(
          `${checkbox} ${
            isFocused ? ctx.printerService.cyan(text) : ctx.printerService.secondary(text)
          }\n`,
        );
      }

      const keyEvent = await ctx.keyReader.readKey();
      if (keyEvent.specialKey === SpecialKey.UP && focusIndex > 0) {
        focusIndex--;
      } else if (keyEvent.specialKey === SpecialKey.DOWN && focusIndex < options.length - 1) {
        focusIndex++;
      } else if (keyEvent.specialKey === SpecialKey.SPACE) {
        if (checked.has(focusIndex)) {
          checked.delete(focusIndex);
        } else {
          checked.add(focusIndex);
        }
      } else if (keyEvent.specialKey === SpecialKey.ENTER) {
        await ctx.terminal.showCursor();
        const values = [...checked].sort().map((i) => options[i]!.returnedValue);
        return { name: promptDef.name, value: values };
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
