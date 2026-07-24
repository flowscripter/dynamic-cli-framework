import type {
  FetchOptions,
  FetchService,
  ShutdownService,
} from "@flowscripter/dynamic-cli-framework-api";
import getLogger from "../../util/logger.ts";

const logger = getLogger("DefaultFetchService");

export default class DefaultFetchService implements FetchService {
  #shutdownService: ShutdownService | undefined;

  public setDependencies(shutdownService: ShutdownService): void {
    this.#shutdownService = shutdownService;
  }

  public async fetch(input: string | URL, options: FetchOptions = {}): Promise<Response> {
    if (this.#shutdownService === undefined) {
      throw new Error("DefaultFetchService.fetch() called before setDependencies()");
    }
    const shutdownService = this.#shutdownService;
    const { timeoutMs, longRunning = false, signal: callerSignal, ...requestInit } = options;

    const controller = new AbortController();
    const signals: AbortSignal[] = [controller.signal];
    if (callerSignal) {
      signals.push(callerSignal);
    }
    if (timeoutMs !== undefined) {
      signals.push(AbortSignal.timeout(timeoutMs));
    }
    const signal = signals.length === 1 ? signals[0]! : AbortSignal.any(signals);

    let settled = false;
    if (longRunning) {
      shutdownService.enterLongRunningMode();
      shutdownService.addShutdownListener(async () => {
        if (settled) {
          return;
        }
        logger.debug(() => `Aborting fetch of '${input.toString()}' due to shutdown`);
        controller.abort();
      });
    }

    try {
      return await fetch(input, { ...requestInit, signal });
    } finally {
      settled = true;
      if (longRunning) {
        shutdownService.leaveLongRunningMode();
      }
    }
  }
}
