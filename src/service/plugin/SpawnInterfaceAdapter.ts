import type { PrinterService, SpawnService } from "@flowscripter/dynamic-cli-framework-api";
import type { SpawnInterface, SpawnResult } from "@flowscripter/dynamic-plugin-framework";

export interface SpawnInterfaceAdapterOptions {
  quoteColor?: string;
  markMinimumDisplayTimeMs?: number;
}

/**
 * Adapts a {@link SpawnService} to dynamic-plugin-framework's {@link SpawnInterface}, wrapping
 * spawned process output in a quoted, marked block via {@link PrinterService} that is cleared
 * again once the process exits (subject to {@link SpawnInterfaceAdapterOptions.markMinimumDisplayTimeMs}).
 */
export default class SpawnInterfaceAdapter implements SpawnInterface {
  readonly #spawnService: SpawnService;
  readonly #printerService: PrinterService;
  readonly #quoteColor: string | undefined;
  readonly #markMinimumDisplayTimeMs: number;

  public constructor(
    spawnService: SpawnService,
    printerService: PrinterService,
    options: SpawnInterfaceAdapterOptions = {},
  ) {
    this.#spawnService = spawnService;
    this.#printerService = printerService;
    this.#quoteColor = options.quoteColor;
    this.#markMinimumDisplayTimeMs = options.markMinimumDisplayTimeMs ?? 1000;
  }

  public async spawn(
    command: ReadonlyArray<string>,
    options: { cwd: string },
  ): Promise<SpawnResult> {
    this.#printerService.startQuote(this.#quoteColor);
    this.#printerService.startMark();

    // onOutput is synchronous and may be called concurrently for stdout/stderr lines, but
    // printerService.info() is async and must not be invoked concurrently with itself - queue
    // writes so they're applied one at a time, in call order.
    let writeQueue: Promise<void> = Promise.resolve();
    const onOutput = (line: string): void => {
      writeQueue = writeQueue.then(() => this.#printerService.info(`${line}\n`));
    };

    const result = await this.#spawnService.spawn(command, {
      cwd: options.cwd,
      mode: "wrapped",
      onOutput,
    });

    await writeQueue;

    this.#printerService.endQuote();
    this.#printerService.endMark();
    await this.#printerService.clearMarked(this.#markMinimumDisplayTimeMs);

    if (result.ok) {
      return { ok: true, exitCode: result.exitCode };
    }
    return "timedOut" in result
      ? { ok: false, error: new Error("Command timed out") }
      : { ok: false, exitCode: result.exitCode, error: result.error };
  }
}
