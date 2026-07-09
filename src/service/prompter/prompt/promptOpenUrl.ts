import type { Prompt, PromptResult } from "@flowscripter/dynamic-cli-framework-api";
import { SpecialKey } from "../../../terminal/KeyReader.ts";
import ShutdownServiceProvider from "../../shutdown/ShutdownServiceProvider.ts";
import { renderPromptHeader } from "./PromptContext.ts";
import type { PromptContext } from "./PromptContext.ts";

function isRemoteSession(): boolean {
  return !!(process.env.SSH_CONNECTION || process.env.SSH_CLIENT || process.env.SSH_TTY);
}

async function defaultOpenUrl(url: string): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }
  const platform = process.platform;
  let cmd: string[];
  if (platform === "darwin") {
    cmd = ["open", url];
  } else if (platform === "win32") {
    cmd = ["cmd", "/c", "start", "", url];
  } else {
    cmd = ["xdg-open", url];
  }
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Failed to open URL (exit code ${exitCode})`);
  }
}

export default async function promptOpenUrl(
  ctx: PromptContext,
  promptDef: Prompt,
): Promise<PromptResult> {
  if (promptDef.options.length === 0) {
    throw new Error(`No URL option for prompt: ${promptDef.name}`);
  }

  const url = String(promptDef.options[0]!.returnedValue);
  const displayLabel = promptDef.options[0]!.displayValue;
  const openUrlFn = ctx.config.openUrl ?? defaultOpenUrl;
  const canOpenBrowser = !isRemoteSession();

  ctx.keyReader.enableRawMode();
  try {
    await renderPromptHeader(ctx, promptDef);

    await ctx.terminal.write(`${displayLabel}: ${ctx.printerService.cyan(url)}\n`);

    const instruction = canOpenBrowser
      ? "Press ENTER to open in the browser..."
      : "Copy the URL above and open it in your local browser, then press ENTER to continue...";
    await ctx.terminal.write(`${ctx.printerService.secondary(instruction)}\n`);

    while (true) {
      const keyEvent = await ctx.keyReader.readKey();

      if (keyEvent.specialKey === SpecialKey.ENTER) {
        if (canOpenBrowser) {
          try {
            await openUrlFn(url);
          } catch (e) {
            await ctx.terminal.write(
              `${ctx.printerService.red(
                `Failed to open URL: ${e instanceof Error ? e.message : String(e)}`,
              )}\n`,
            );
          }
        }
        return { name: promptDef.name, value: url };
      } else if (keyEvent.specialKey === SpecialKey.ESCAPE) {
        throw new Error("Prompt cancelled");
      } else if (keyEvent.specialKey === SpecialKey.INTERRUPT) {
        ShutdownServiceProvider.onInterrupt();
        throw new Error("Interrupted");
      }
    }
  } finally {
    ctx.keyReader.disableRawMode();
  }
}
