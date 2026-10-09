import { describe, expect, test } from "bun:test";
import {
  describeSpawnFailure,
  spawnQuoted,
} from "../../../../src/service/upgrade/method/shared.ts";
import { getFakePrinterService } from "../../../fixtures/PrinterService.ts";
import { getSpawnService } from "../../../fixtures/SpawnService.ts";

describe("describeSpawnFailure", () => {
  test("describes a timeout, an error and an exit code", () => {
    expect(describeSpawnFailure({ ok: false, timedOut: true })).toEqual("timed out");
    expect(describeSpawnFailure({ ok: false, error: new Error("ENOENT") })).toEqual("ENOENT");
    expect(describeSpawnFailure({ ok: false, exitCode: 3 })).toEqual("exit code 3");
  });
});

describe("spawnQuoted", () => {
  test("ignores output when there is no PrinterService", async () => {
    const { spawnService, calls } = getSpawnService(() => ({ ok: true, exitCode: 0 }));
    const result = await spawnQuoted(spawnService, undefined, ["echo", "hi"]);
    expect(result.ok).toBe(true);
    expect(calls[0]?.options?.mode).toEqual("ignore");
  });

  test("wraps the output in quote/mark and clears it on success", async () => {
    const { spawnService, calls } = getSpawnService(
      () => ({ ok: true, exitCode: 0 }),
      () => ["line one", "line two"],
    );
    const { printerService, state } = getFakePrinterService();

    const result = await spawnQuoted(spawnService, printerService, ["echo", "hi"]);

    expect(result.ok).toBe(true);
    expect(calls[0]?.options?.mode).toEqual("wrapped");
    expect(state.calls).toEqual([
      "startQuote",
      "startMark",
      "info",
      "info",
      "endQuote",
      "endMark",
      "clearMarked",
    ]);
    expect(state.infoMessages).toEqual(["line one\n", "line two\n"]);
  });

  test("leaves the output visible when the command fails", async () => {
    const { spawnService } = getSpawnService(
      () => ({ ok: false, exitCode: 1 }),
      () => ["Error: formula not found"],
    );
    const { printerService, state } = getFakePrinterService();

    const result = await spawnQuoted(spawnService, printerService, ["brew", "upgrade"]);

    expect(result.ok).toBe(false);
    expect(state.calls).toContain("discardMark");
    expect(state.calls).not.toContain("clearMarked");
  });
});
