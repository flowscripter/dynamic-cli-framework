import type {
  FetchOptions,
  FetchService,
  PrinterService,
  SpawnOptions,
  SpawnResult,
  SpawnService,
} from "@flowscripter/dynamic-cli-framework-api";

export interface SpawnCall {
  command: ReadonlyArray<string>;
  options?: SpawnOptions;
}

// Records every spawn() call, feeds the output lines for a command through onOutput when the
// handler provides them, and returns the handler's result.
export function getSpawnService(
  handler: (command: ReadonlyArray<string>) => SpawnResult,
  outputFor: (command: ReadonlyArray<string>) => ReadonlyArray<string> = () => [],
): { spawnService: SpawnService; calls: SpawnCall[] } {
  const calls: SpawnCall[] = [];
  const spawnService = {
    spawn: (command: ReadonlyArray<string>, options?: SpawnOptions) => {
      calls.push({ command, options });
      if (options && "onOutput" in options && typeof options.onOutput === "function") {
        for (const line of outputFor(command)) {
          options.onOutput(line, "stdout");
        }
      }
      return Promise.resolve(handler(command));
    },
  } as unknown as SpawnService;
  return { spawnService, calls };
}

export function getFetchService(
  handler: (input: string | URL, options?: FetchOptions) => Response | Promise<Response>,
): FetchService {
  return {
    fetch: (input, options) => Promise.resolve(handler(input, options)),
  };
}

export interface FakePrinterServiceState {
  calls: string[];
  infoMessages: string[];
}

export function getFakePrinterService(): {
  printerService: PrinterService;
  state: FakePrinterServiceState;
} {
  const state: FakePrinterServiceState = { calls: [], infoMessages: [] };
  const printerService = {
    startQuote: () => {
      state.calls.push("startQuote");
    },
    endQuote: () => {
      state.calls.push("endQuote");
    },
    startMark: () => {
      state.calls.push("startMark");
    },
    endMark: () => {
      state.calls.push("endMark");
    },
    clearMarked: () => {
      state.calls.push("clearMarked");
      return Promise.resolve();
    },
    discardMark: () => {
      state.calls.push("discardMark");
    },
    info: (message: string) => {
      state.calls.push("info");
      state.infoMessages.push(message);
      return Promise.resolve();
    },
  } as unknown as PrinterService;
  return { printerService, state };
}
