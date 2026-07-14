import type {
  PrinterService,
  ShutdownService,
  SpawnOptions,
  SpawnResult,
  SpawnService,
} from "@flowscripter/dynamic-cli-framework-api";
import getLogger from "../../util/logger.ts";

const logger = getLogger("DefaultSpawnService");

const SHUTDOWN_GRACE_PERIOD_MS = 5000;

export default class DefaultSpawnService implements SpawnService {
  #printerService: PrinterService | undefined;
  #shutdownService: ShutdownService | undefined;

  public setDependencies(printerService: PrinterService, shutdownService: ShutdownService): void {
    this.#printerService = printerService;
    this.#shutdownService = shutdownService;
  }

  async #pipeLines(
    stream: ReadableStream<Uint8Array> | number | undefined,
    streamName: "stdout" | "stderr",
    onOutput: (line: string, stream: "stdout" | "stderr") => void,
  ): Promise<void> {
    if (typeof stream !== "object" || stream === null) {
      return;
    }
    const decoder = new TextDecoder();
    const reader = stream.getReader();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        onOutput(buffer.slice(0, newlineIndex), streamName);
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
      }
    }
    if (buffer.length > 0) {
      onOutput(buffer, streamName);
    }
  }

  public async spawn(
    command: ReadonlyArray<string>,
    options: SpawnOptions = {},
  ): Promise<SpawnResult> {
    if (this.#printerService === undefined || this.#shutdownService === undefined) {
      throw new Error("DefaultSpawnService.spawn() called before setDependencies()");
    }
    const printerService = this.#printerService;
    const shutdownService = this.#shutdownService;
    const stdio = options.stdio ?? "inherit";
    const longRunning = options.longRunning ?? true;

    if (stdio === "inherit") {
      await printerService.hideSpinner();
      await printerService.hideAllProgressBars();
    }

    let proc;
    try {
      proc = Bun.spawn([...command], {
        cwd: options.cwd,
        stdin: stdio === "wrapped" ? "ignore" : "inherit",
        stdout: stdio === "wrapped" ? "pipe" : "inherit",
        stderr: stdio === "wrapped" ? "pipe" : "inherit",
      });
    } catch (error) {
      logger.debug(() => `Failed to launch command '${command.join(" ")}': ${error}`);
      return { ok: false, error: error as Error };
    }

    let settled = false;

    if (longRunning) {
      shutdownService.enterLongRunningMode();
    }

    shutdownService.addShutdownListener(async () => {
      if (settled) {
        return;
      }
      logger.debug(() => `Sending SIGTERM to spawned command '${command.join(" ")}'`);
      proc.kill("SIGTERM");
      await Promise.race([
        proc.exited.then(() => {}),
        new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_GRACE_PERIOD_MS)),
      ]);
      if (!settled) {
        logger.debug(() => `Sending SIGKILL to spawned command '${command.join(" ")}'`);
        proc.kill("SIGKILL");
      }
    });

    if (stdio === "wrapped" && options.onOutput) {
      const onOutput = options.onOutput;
      void this.#pipeLines(proc.stdout, "stdout", onOutput);
      void this.#pipeLines(proc.stderr, "stderr", onOutput);
    }

    try {
      const exitCode = await proc.exited;
      settled = true;
      return exitCode === 0 ? { ok: true, exitCode } : { ok: false, exitCode };
    } finally {
      if (longRunning) {
        shutdownService.leaveLongRunningMode();
      }
    }
  }
}
