import type { PrinterService, SpawnService } from "@flowscripter/dynamic-cli-framework-api";
import type { SpawnInterface, SpawnResult } from "@flowscripter/dynamic-plugin-framework";

export interface SpawnInterfaceAdapterOptions {
  quoteColor?: string;
  markMinimumDisplayTimeMs?: number;
}

/**
 * Adapts a {@link SpawnService} to dynamic-plugin-framework's {@link SpawnInterface}, wrapping
 * spawned process output in a quoted, marked block via {@link PrinterService}. On success the
 * block is cleared once the process exits (subject to
 * {@link SpawnInterfaceAdapterOptions.markMinimumDisplayTimeMs}); on failure the block is left
 * on screen so the diagnostic output from the failing command remains visible.
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
    if (result.ok) {
      await this.#printerService.clearMarked(this.#markMinimumDisplayTimeMs);
    } else if ("discardMark" in this.#printerService) {
      // Leave the marked/quoted output on screen so the failing command's diagnostic output is
      // visible, but still reset the mark/quote bookkeeping so a subsequent spawn() can start a
      // fresh mark region.
      //
      // discardMark() is being promoted to a first-class PrinterService interface method
      // (flowscripter/dynamic-cli-framework-api#12); once that's released and this repo's
      // @flowscripter/dynamic-cli-framework-api dependency is bumped, this can call
      // this.#printerService.discardMark() directly instead of feature-detecting it.
      (this.#printerService as unknown as { discardMark: () => void }).discardMark();
    }

    if (result.ok) {
      return { ok: true, exitCode: result.exitCode };
    }
    return "timedOut" in result
      ? { ok: false, error: new Error("Command timed out") }
      : { ok: false, exitCode: result.exitCode, error: result.error };
  }
}
