import type { Prompt, PromptResult, SpawnService } from "@flowscripter/dynamic-cli-framework-api";
import { SpecialKey } from "../../../terminal/KeyReader.ts";
import { getSpawnService, interrupt, renderPromptHeader } from "./PromptContext.ts";
import type { PromptContext } from "./PromptContext.ts";

function isRemoteSession(): boolean {
  return !!(process.env.SSH_CONNECTION || process.env.SSH_CLIENT || process.env.SSH_TTY);
}

export async function defaultOpenUrl(spawnService: SpawnService, url: string): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }
  let cmd: string[];
  if (process.platform === "darwin") {
    cmd = ["open", url];
  } else if (process.platform === "win32") {
    cmd = ["cmd", "/c", "start", "", url];
  } else {
    cmd = ["xdg-open", url];
  }
  const result = await spawnService.spawn(cmd, { mode: "ignore", longRunning: false });
  if (result.ok) {
    return;
  }
  if ("error" in result && result.error) {
    throw result.error;
  }
  throw new Error(
    `Failed to open URL (exit code ${"exitCode" in result ? result.exitCode : "unknown"})`,
  );
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
  const spawnService = getSpawnService(ctx);
  const openUrlFn =
    ctx.config.openUrl ??
    (spawnService ? (target: string) => defaultOpenUrl(spawnService, target) : undefined);
  const canOpenBrowser = openUrlFn !== undefined && !isRemoteSession();

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
        interrupt(ctx);
        throw new Error("Interrupted");
      }
    }
  } finally {
    ctx.keyReader.disableRawMode();
  }
}
