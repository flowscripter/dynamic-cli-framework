import type {
  Context,
  FetchOptions,
  FetchService,
  ShutdownService,
} from "@flowscripter/dynamic-cli-framework-api";
import { SHUTDOWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import getLogger from "../../util/logger.ts";

const logger = getLogger("DefaultFetchService");

export default class DefaultFetchService implements FetchService {
  #context: Context | undefined;

  public setContext(context: Context): void {
    this.#context = context;
  }

  public async fetch(input: string | URL, options: FetchOptions = {}): Promise<Response> {
    if (this.#context === undefined) {
      throw new Error("DefaultFetchService.fetch() called before setContext()");
    }
    const shutdownService = this.#context.getServiceById(SHUTDOWN_SERVICE_ID) as ShutdownService;
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
      shutdownService.registerTask({
        id: `fetch:${input.toString()}`,
        priority: 0,
        run: async () => {
          if (settled) {
            return;
          }
          logger.debug(() => `Aborting fetch of '${input.toString()}' due to shutdown`);
          controller.abort();
        },
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
