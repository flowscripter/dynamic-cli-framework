import { describe, expect, test } from "bun:test";
import SpawnInterfaceAdapter from "../../../src/service/plugin/SpawnInterfaceAdapter.ts";
import type {
  PrinterService,
  SpawnOptions,
  SpawnService,
} from "@flowscripter/dynamic-cli-framework-api";

interface FakePrinterServiceState {
  calls: string[];
  infoMessages: string[];
}

function getFakePrinterService(): {
  printerService: PrinterService;
  state: FakePrinterServiceState;
} {
  const state: FakePrinterServiceState = { calls: [], infoMessages: [] };
  const printerService = {
    startQuote: (color?: string) => {
      state.calls.push(`startQuote(${color ?? ""})`);
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
    clearMarked: (minimumDisplayTimeMs?: number) => {
      state.calls.push(`clearMarked(${minimumDisplayTimeMs ?? ""})`);
      return Promise.resolve();
    },
    info: (message: string) => {
      state.calls.push("info");
      state.infoMessages.push(message);
      return Promise.resolve();
    },
  } as unknown as PrinterService;
  return { printerService, state };
}

function getFakeSpawnService(
  onOutputLines: Array<{ line: string; stream: "stdout" | "stderr" }>,
  result: { ok: boolean; exitCode?: number; error?: Error },
): SpawnService {
  return {
    spawn: (_command: ReadonlyArray<string>, options?: SpawnOptions) => {
      if (options?.onOutput) {
        for (const { line, stream } of onOutputLines) {
          options.onOutput(line, stream);
        }
      }
      return Promise.resolve(result);
    },
  } as unknown as SpawnService;
}

describe("SpawnInterfaceAdapter tests", () => {
  test("wraps spawn output in a quoted, marked block written via info()", async () => {
    const { printerService, state } = getFakePrinterService();
    const spawnService = getFakeSpawnService(
      [
        { line: "line1", stream: "stdout" },
        { line: "line2", stream: "stderr" },
      ],
      { ok: true, exitCode: 0 },
    );
    const adapter = new SpawnInterfaceAdapter(spawnService, printerService);

    const result = await adapter.spawn(["bun", "add", "foo"], { cwd: "/tmp" });

    expect(result).toEqual({ ok: true, exitCode: 0 });
    expect(state.calls).toEqual([
      "startQuote()",
      "startMark",
      "info",
      "info",
      "endQuote",
      "endMark",
      "clearMarked(1000)",
    ]);
    expect(state.infoMessages).toEqual(["line1\n", "line2\n"]);
  });

  test("passes quoteColor and markMinimumDisplayTimeMs options through", async () => {
    const { printerService, state } = getFakePrinterService();
    const spawnService = getFakeSpawnService([], { ok: true, exitCode: 0 });
    const adapter = new SpawnInterfaceAdapter(spawnService, printerService, {
      quoteColor: "#ff0000",
      markMinimumDisplayTimeMs: 2000,
    });

    await adapter.spawn(["echo", "hi"], { cwd: "/tmp" });

    expect(state.calls).toContain("startQuote(#ff0000)");
    expect(state.calls).toContain("clearMarked(2000)");
  });

  test("maps a failed SpawnResult through", async () => {
    const { printerService } = getFakePrinterService();
    const error = new Error("ENOENT");
    const spawnService = getFakeSpawnService([], { ok: false, error });
    const adapter = new SpawnInterfaceAdapter(spawnService, printerService);

    const result = await adapter.spawn(["nonexistent"], { cwd: "/tmp" });

    expect(result).toEqual({ ok: false, exitCode: undefined, error });
  });
});
