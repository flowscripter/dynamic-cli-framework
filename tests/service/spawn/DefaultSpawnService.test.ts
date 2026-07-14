import { describe, expect, test } from "bun:test";
import DefaultSpawnService from "../../../src/service/spawn/DefaultSpawnService.ts";
import type { PrinterService, ShutdownService } from "@flowscripter/dynamic-cli-framework-api";

interface FakePrinterServiceState {
  hideSpinnerCalls: number;
  hideAllProgressBarsCalls: number;
}

function getFakePrinterService(): {
  printerService: PrinterService;
  state: FakePrinterServiceState;
} {
  const state: FakePrinterServiceState = {
    hideSpinnerCalls: 0,
    hideAllProgressBarsCalls: 0,
  };
  const printerService = {
    hideSpinner: () => {
      state.hideSpinnerCalls++;
      return Promise.resolve();
    },
    hideAllProgressBars: () => {
      state.hideAllProgressBarsCalls++;
      return Promise.resolve();
    },
  } as unknown as PrinterService;
  return { printerService, state };
}

interface FakeShutdownServiceState {
  enterLongRunningModeCalls: number;
  leaveLongRunningModeCalls: number;
  listeners: Array<() => Promise<void>>;
}

function getFakeShutdownService(): {
  shutdownService: ShutdownService;
  state: FakeShutdownServiceState;
} {
  const state: FakeShutdownServiceState = {
    enterLongRunningModeCalls: 0,
    leaveLongRunningModeCalls: 0,
    listeners: [],
  };
  const shutdownService: ShutdownService = {
    addShutdownListener: (callback) => {
      state.listeners.push(callback);
    },
    enterLongRunningMode: () => {
      state.enterLongRunningModeCalls++;
    },
    leaveLongRunningMode: () => {
      state.leaveLongRunningModeCalls++;
    },
    isShutdownRequested: false,
  };
  return { shutdownService, state };
}

describe("DefaultSpawnService tests", () => {
  test("spawn() throws if called before setDependencies()", () => {
    const service = new DefaultSpawnService();

    expect(service.spawn(["echo", "hello"])).rejects.toThrow(
      "DefaultSpawnService.spawn() called before setDependencies()",
    );
  });

  test("spawn() resolves ok:true with exitCode 0 for a successful command", async () => {
    const service = new DefaultSpawnService();
    const { printerService } = getFakePrinterService();
    const { shutdownService } = getFakeShutdownService();
    service.setDependencies(printerService, shutdownService);

    const result = await service.spawn(["echo", "hello"]);

    expect(result).toEqual({ ok: true, exitCode: 0 });
  });

  test("spawn() resolves ok:false with exitCode for a non-zero exit", async () => {
    const service = new DefaultSpawnService();
    const { printerService } = getFakePrinterService();
    const { shutdownService } = getFakeShutdownService();
    service.setDependencies(printerService, shutdownService);

    const result = await service.spawn(["sh", "-c", "exit 3"]);

    expect(result).toEqual({ ok: false, exitCode: 3 });
  });

  test("spawn() resolves ok:false with error for a nonexistent binary", async () => {
    const service = new DefaultSpawnService();
    const { printerService } = getFakePrinterService();
    const { shutdownService } = getFakeShutdownService();
    service.setDependencies(printerService, shutdownService);

    const result = await service.spawn(["definitely-not-a-real-binary-xyz"]);

    expect(result.ok).toBeFalse();
    expect((result as { error?: Error }).error).toBeDefined();
  });

  test("spawn() with stdio wrapped invokes onOutput per line", async () => {
    const service = new DefaultSpawnService();
    const { printerService } = getFakePrinterService();
    const { shutdownService } = getFakeShutdownService();
    service.setDependencies(printerService, shutdownService);

    const lines: Array<{ line: string; stream: "stdout" | "stderr" }> = [];
    const result = await service.spawn(["sh", "-c", "echo out1; echo err1 >&2"], {
      stdio: "wrapped",
      onOutput: (line, stream) => lines.push({ line, stream }),
    });

    expect(result).toEqual({ ok: true, exitCode: 0 });
    expect(lines).toContainEqual({ line: "out1", stream: "stdout" });
    expect(lines).toContainEqual({ line: "err1", stream: "stderr" });
  });

  test("spawn() pauses spinner and progress bars in inherit mode", async () => {
    const service = new DefaultSpawnService();
    const { printerService, state } = getFakePrinterService();
    const { shutdownService } = getFakeShutdownService();
    service.setDependencies(printerService, shutdownService);

    await service.spawn(["echo", "hello"]);

    expect(state.hideSpinnerCalls).toBeGreaterThanOrEqual(1);
    expect(state.hideAllProgressBarsCalls).toBeGreaterThanOrEqual(1);
  });

  test("spawn() enters and leaves long-running mode by default", async () => {
    const service = new DefaultSpawnService();
    const { printerService } = getFakePrinterService();
    const { shutdownService, state } = getFakeShutdownService();
    service.setDependencies(printerService, shutdownService);

    await service.spawn(["echo", "hello"]);

    expect(state.enterLongRunningModeCalls).toEqual(1);
    expect(state.leaveLongRunningModeCalls).toEqual(1);
  });

  test("spawn() does not enter long-running mode when longRunning is false", async () => {
    const service = new DefaultSpawnService();
    const { printerService } = getFakePrinterService();
    const { shutdownService, state } = getFakeShutdownService();
    service.setDependencies(printerService, shutdownService);

    await service.spawn(["echo", "hello"], { longRunning: false });

    expect(state.enterLongRunningModeCalls).toEqual(0);
  });

  test("spawn() registers a shutdown listener", async () => {
    const service = new DefaultSpawnService();
    const { printerService } = getFakePrinterService();
    const { shutdownService, state } = getFakeShutdownService();
    service.setDependencies(printerService, shutdownService);

    await service.spawn(["echo", "hello"]);

    expect(state.listeners.length).toEqual(1);
  });
});
