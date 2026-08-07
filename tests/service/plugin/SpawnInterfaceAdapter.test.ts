import { describe, expect, test } from "bun:test";
import SpawnInterfaceAdapter from "../../../src/service/plugin/SpawnInterfaceAdapter.ts";
import type {
  PrinterService,
  ShutdownService,
  SpawnOptions,
  SpawnService,
} from "@flowscripter/dynamic-cli-framework-api";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";
import DefaultSpawnService from "../../../src/service/spawn/DefaultSpawnService.ts";
import TtyTerminal from "../../../src/terminal/TtyTerminal.ts";
import TtyStyler from "../../../src/terminal/TtyStyler.ts";
import { tmpdir } from "node:os";
import StreamString from "../../fixtures/StreamString.ts";

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

function getFakeSpawnService(
  onOutputLines: Array<{ line: string; stream: "stdout" | "stderr" }>,
  result: { ok: boolean; exitCode?: number; error?: Error; timedOut?: boolean },
): { spawnService: SpawnService; receivedOptions: Array<SpawnOptions | undefined> } {
  const receivedOptions: Array<SpawnOptions | undefined> = [];
  const spawnService = {
    spawn: (_command: ReadonlyArray<string>, options?: SpawnOptions) => {
      receivedOptions.push(options);
      if (options?.onOutput) {
        for (const { line, stream } of onOutputLines) {
          options.onOutput(line, stream);
        }
      }
      return Promise.resolve(result);
    },
  } as unknown as SpawnService;
  return { spawnService, receivedOptions };
}

describe("SpawnInterfaceAdapter tests", () => {
  test("wraps spawn output in a quoted, marked block written via info()", async () => {
    const { printerService, state } = getFakePrinterService();
    const { spawnService } = getFakeSpawnService(
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
    const { spawnService } = getFakeSpawnService([], { ok: true, exitCode: 0 });
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
    const { spawnService } = getFakeSpawnService([], { ok: false, error });
    const adapter = new SpawnInterfaceAdapter(spawnService, printerService);

    const result = await adapter.spawn(["nonexistent"], { cwd: "/tmp" });

    expect(result).toEqual({ ok: false, exitCode: undefined, error });
  });

  test("does not clear the marked/quoted block on failure, but resets mark bookkeeping", async () => {
    const { printerService, state } = getFakePrinterService();
    const { spawnService } = getFakeSpawnService(
      [{ line: "some diagnostic output", stream: "stderr" }],
      { ok: false, exitCode: 1, error: undefined },
    );
    const adapter = new SpawnInterfaceAdapter(spawnService, printerService);

    await adapter.spawn(["bun", "add", "foo"], { cwd: "/tmp" });

    expect(state.calls).toEqual([
      "startQuote()",
      "startMark",
      "info",
      "endQuote",
      "endMark",
      "discardMark",
    ]);
    expect(state.calls).not.toContain("clearMarked(1000)");
  });

  test("clears the marked/quoted block on success", async () => {
    const { printerService, state } = getFakePrinterService();
    const { spawnService } = getFakeSpawnService([{ line: "installed ok", stream: "stdout" }], {
      ok: true,
      exitCode: 0,
    });
    const adapter = new SpawnInterfaceAdapter(spawnService, printerService);

    await adapter.spawn(["bun", "add", "foo"], { cwd: "/tmp" });

    expect(state.calls).toEqual([
      "startQuote()",
      "startMark",
      "info",
      "endQuote",
      "endMark",
      "clearMarked(1000)",
    ]);
    expect(state.calls).not.toContain("discardMark");
  });

  test("integration: clears only the spawned block's rows on success, leaving earlier stderr output (e.g. a banner) untouched", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    printerService.colorEnabled = false;
    const shutdownService: ShutdownService = {
      addShutdownListener: () => {},
      enterLongRunningMode: () => {},
      leaveLongRunningMode: () => {},
      isShutdownRequested: false,
    };
    const spawnService = new DefaultSpawnService();
    spawnService.setDependencies(printerService, shutdownService);
    const adapter = new SpawnInterfaceAdapter(spawnService, printerService);

    // Simulate a banner printed before the spawn runs - this must survive the clear.
    await printerService.info("banner line 1\n");
    await printerService.info("banner line 2\n");
    const preSpawnOutput = dummyStderr.getString();

    const lineCount = 11;
    const result = await adapter.spawn(
      [
        process.execPath,
        "-e",
        `for (let i = 1; i <= ${lineCount}; i++) { console.log("line" + i); }`,
      ],
      { cwd: tmpdir() },
    );

    expect(result).toEqual({ ok: true, exitCode: 0 });

    const finalOutput = dummyStderr.getString();
    expect(finalOutput.startsWith(preSpawnOutput)).toBeTrue();

    const postSpawnOutput = finalOutput.slice(preSpawnOutput.length);
    // Exactly `lineCount` erase operations, matching the number of physical lines actually
    // written by the spawned command - not double, and not extending into the banner.
    const clearCount = postSpawnOutput.split("\x1b[1A\x1b[2K").length - 1;
    expect(clearCount).toEqual(lineCount);
    expect(preSpawnOutput).toEqual("banner line 1\nbanner line 2\n");
  });

  test("integration: with color enabled, clears exactly the spawned block's rows on success, leaving an earlier colored banner byte-for-byte intact (#150)", async () => {
    // Regression test for #150: colorText()/prefixLines() wrap an entire message - including a
    // trailing "\n" - with ANSI codes appended *after* that newline (e.g. "foo\n" becomes
    // "<color>foo\n<reset>"). Line-counting logic that naively checks endsWith("\n") on already
    // -colored text mis-detects such lines as 2 physical rows instead of 1, so a marked block's
    // tracked row count silently drifts above its real height - and clearMarked() then erases
    // past the top of the block into whatever was printed earlier (e.g. the startup banner).
    // This only reproduces with color enabled - colorText() is a no-op when colors are off,
    // which is why the color-disabled integration test above did not catch it.
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    const shutdownService: ShutdownService = {
      addShutdownListener: () => {},
      enterLongRunningMode: () => {},
      leaveLongRunningMode: () => {},
      isShutdownRequested: false,
    };
    const spawnService = new DefaultSpawnService();
    spawnService.setDependencies(printerService, shutdownService);
    const adapter = new SpawnInterfaceAdapter(spawnService, printerService);

    // Simulate a real (colored) startup banner printed before the spawn runs, including a
    // blank trailing line, matching BannerServiceProvider's actual usage.
    await printerService.info(printerService.blue("banner line 1\n"));
    await printerService.info(`  ${printerService.primary("banner line 2")}\n`);
    await printerService.info(`  ${printerService.secondary("version: 1.0.0")}\n`);
    await printerService.info("\n");
    const preSpawnOutput = dummyStderr.getString();

    // Mix stdout/stderr lines, including a blank line, to mirror a real `bun add` invocation.
    const lineCount = 11;
    const result = await adapter.spawn(
      [
        process.execPath,
        "-e",
        `for (let i = 1; i <= ${lineCount}; i++) { ` +
          `if (i % 2 === 0) { console.error(i === 6 ? "" : "line" + i); } ` +
          `else { console.log("line" + i); } }`,
      ],
      { cwd: tmpdir() },
    );

    expect(result).toEqual({ ok: true, exitCode: 0 });

    const finalOutput = dummyStderr.getString();
    // The banner must survive byte-for-byte - the clear must not eat into it.
    expect(finalOutput.startsWith(preSpawnOutput)).toBeTrue();

    const postSpawnOutput = finalOutput.slice(preSpawnOutput.length);
    const clearCount = postSpawnOutput.split("\x1b[1A\x1b[2K").length - 1;
    // Exactly `lineCount` erase operations - not double (the historical symptom), and not
    // extending into the banner printed beforehand.
    expect(clearCount).toEqual(lineCount);

    // The doubled quote-prefix symptom from #150's original report ("Quote's │ prefix rendered
    // as if two quote levels were active") must not reappear either.
    expect(postSpawnOutput).not.toContain("│ │");
  });

  test("integration: leaves output on screen (does not clear) on failure, via real spawn/printer services", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStdout.writeStream),
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    printerService.colorEnabled = false;
    const shutdownService: ShutdownService = {
      addShutdownListener: () => {},
      enterLongRunningMode: () => {},
      leaveLongRunningMode: () => {},
      isShutdownRequested: false,
    };
    const spawnService = new DefaultSpawnService();
    spawnService.setDependencies(printerService, shutdownService);
    const adapter = new SpawnInterfaceAdapter(spawnService, printerService);

    const result = await adapter.spawn(
      [process.execPath, "-e", `console.log("diagnostic output"); process.exit(1);`],
      { cwd: tmpdir() },
    );

    expect(result).toEqual({ ok: false, exitCode: 1 });
    const output = dummyStderr.getString();
    expect(output).not.toContain("\x1b[1A\x1b[2K");
    expect(output).toContain("diagnostic output");

    // A subsequent spawn() must not throw "already marking" - bookkeeping was reset.
    const secondResult = await adapter.spawn([process.execPath, "-e", `console.log("hello");`], {
      cwd: tmpdir(),
    });
    expect(secondResult.ok).toBeTrue();
  });

  test("forwards timeoutMs from spawn() options through to the underlying SpawnService", async () => {
    const { printerService } = getFakePrinterService();
    const { spawnService, receivedOptions } = getFakeSpawnService([], { ok: true, exitCode: 0 });
    const adapter = new SpawnInterfaceAdapter(spawnService, printerService);

    await adapter.spawn(["bun", "add", "foo"], { cwd: "/tmp", timeoutMs: 5000 });

    expect(receivedOptions[0]?.timeoutMs).toBe(5000);
  });

  test("omits timeoutMs when not provided to spawn()", async () => {
    const { printerService } = getFakePrinterService();
    const { spawnService, receivedOptions } = getFakeSpawnService([], { ok: true, exitCode: 0 });
    const adapter = new SpawnInterfaceAdapter(spawnService, printerService);

    await adapter.spawn(["bun", "add", "foo"], { cwd: "/tmp" });

    expect(receivedOptions[0]?.timeoutMs).toBeUndefined();
  });

  test("maps a timed-out SpawnService result to a timedOut SpawnResult", async () => {
    const { printerService } = getFakePrinterService();
    const { spawnService } = getFakeSpawnService([], { ok: false, timedOut: true });
    const adapter = new SpawnInterfaceAdapter(spawnService, printerService);

    const result = await adapter.spawn(["bun", "add", "foo"], { cwd: "/tmp", timeoutMs: 5000 });

    expect(result).toEqual({ ok: false, timedOut: true });
  });
});
