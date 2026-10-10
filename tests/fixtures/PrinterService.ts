import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";

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
