import type {
  PrinterService,
  SpawnResult,
  SpawnService,
} from "@flowscripter/dynamic-cli-framework-api";

export type VersionLookupResult =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly error: Error };

export function describeSpawnFailure(result: Extract<SpawnResult, { ok: false }>): string {
  return "timedOut" in result
    ? "timed out"
    : (result.error?.message ?? `exit code ${result.exitCode}`);
}

// Mirrors SpawnInterfaceAdapter's plugin:add/plugin:remove pattern: wrap a spawned command's
// output in a quoted, marked block that's cleared on success (so a clean install stays quiet)
// but left on screen on failure (so the diagnostic output remains visible).
export async function spawnQuoted(
  spawnService: SpawnService,
  printerService: PrinterService | undefined,
  command: ReadonlyArray<string>,
): Promise<SpawnResult> {
  if (!printerService) {
    return spawnService.spawn(command, { mode: "ignore" });
  }

  printerService.startQuote();
  printerService.startMark();

  // onOutput is synchronous and may be called concurrently for stdout/stderr lines, but
  // printerService.info() is async and must not be invoked concurrently with itself - queue
  // writes so they're applied one at a time, in call order.
  let writeQueue: Promise<void> = Promise.resolve();
  const onOutput = (line: string): void => {
    writeQueue = writeQueue.then(() => printerService.info(`${line}\n`));
  };

  const result = await spawnService.spawn(command, { mode: "wrapped", onOutput });
  await writeQueue;

  printerService.endQuote();
  printerService.endMark();
  if (result.ok) {
    await printerService.clearMarked();
  } else {
    printerService.discardMark();
  }
  return result;
}
