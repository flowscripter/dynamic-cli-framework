import { describe, expect, test } from "bun:test";
import Progress, { ProgressStyle } from "../../../../src/service/printer/terminal/Progress.ts";
import { sleep } from "../../../fixtures/util.ts";
import TtyTerminal from "../../../../src/terminal/TtyTerminal.ts";
import StreamString from "../../../fixtures/StreamString.ts";
import TtyStyler from "../../../../src/terminal/TtyStyler.ts";

describe("Progress tests", () => {
  test("Progress works", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const progress = new Progress(terminal, new TtyStyler(3));

    const handle = progress.add("foo", "bar", 100, 0);
    await sleep(150);
    progress.update(handle, 50, "bar2");
    await sleep(150);
    progress.update(handle, 150, "bar3");
    await sleep(150);
    await progress.hide(handle);
  });

  test("Multiple progress works", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const progress = new Progress(terminal, new TtyStyler(3));

    const handle1 = progress.add("foo1", "bar2", 100, 0);
    const handle2 = progress.add("foo2", "bar2", 200, 0);
    await sleep(150);
    progress.update(handle1, 50, "bar3");
    await sleep(150);
    progress.update(handle2, 100, "bar4");
    await sleep(150);
    progress.update(handle1, 50, "bar3");
    progress.update(handle2, 200, "bar5 very long string now");
    await sleep(150);
    await progress.hideAll();
  });

  test("Default style is STROKE and uses = and - characters", async () => {
    const streamString = new StreamString();
    (streamString.writeStream as unknown as { columns: number }).columns = 120;
    const terminal = new TtyTerminal(streamString.writeStream);
    const progress = new Progress(terminal, new TtyStyler(3));

    const handle = progress.add("bytes", "downloading", 100, 50);
    await sleep(150);
    const output = streamString.getString();
    expect(output).toContain("=");
    expect(output).toContain("-");
    expect(output).not.toContain("▰");
    expect(output).not.toContain("▱");
    await progress.hide(handle);
  });

  test("FILL style uses block characters", async () => {
    const streamString = new StreamString();
    (streamString.writeStream as unknown as { columns: number }).columns = 120;
    const terminal = new TtyTerminal(streamString.writeStream);
    const progress = new Progress(terminal, new TtyStyler(3));

    progress.progressStyle = ProgressStyle.FILL;
    const handle = progress.add("bytes", "downloading", 100, 50);
    await sleep(150);
    const output = streamString.getString();
    expect(output).toContain("▰");
    expect(output).toContain("▱");
    expect(output).not.toContain("=");
    await progress.hide(handle);
  });

  test("progressStyle can be changed between renders", async () => {
    const streamString = new StreamString();
    (streamString.writeStream as unknown as { columns: number }).columns = 120;
    const terminal = new TtyTerminal(streamString.writeStream);
    const progress = new Progress(terminal, new TtyStyler(3));

    const handle = progress.add("bytes", "downloading", 100, 50);
    await sleep(150);
    let output = streamString.getString();
    expect(output).toContain("=");

    progress.progressStyle = ProgressStyle.FILL;
    progress.update(handle, 75);
    await sleep(150);
    output = streamString.getString();
    expect(output).toContain("▰");
    await progress.hide(handle);
  });

  test("rate estimate converges to the true rate within a few updates", async () => {
    const streamString = new StreamString();
    (streamString.writeStream as unknown as { columns: number }).columns = 120;
    const terminal = new TtyTerminal(streamString.writeStream);
    const progress = new Progress(terminal, new TtyStyler(3));

    const realDateNow = Date.now;
    let fakeNow = 1_000_000;
    Date.now = () => fakeNow;

    let handle!: number;
    try {
      handle = progress.add("bytes", "hashing", 100_000_000, 0);
      // Noisy/slow first sample: only 1000 bytes in the first (simulated) second.
      fakeNow += 1000;
      progress.update(handle, 1000);
      // Then a steady true rate of 1,000,000 bytes/s for the next 5 seconds.
      for (let i = 1; i <= 50; i++) {
        fakeNow += 100;
        progress.update(handle, 1000 + i * 100_000);
      }
    } finally {
      Date.now = realDateNow;
    }

    await sleep(150);
    const output = streamString.getString();
    const afterRate = output.slice(output.indexOf("rate:"));
    const match = /\d+\.\d+/.exec(afterRate);
    expect(match).not.toBeNull();
    expect(Number(match![0])).toBeGreaterThan(500_000);
    await progress.hide(handle);
  });

  test("bar renders with visible fill chars at a realistic terminal width", async () => {
    const streamString = new StreamString();
    // Comfortably wider than the actual visible suffix text (~85 chars for this scenario).
    (streamString.writeStream as unknown as { columns: number }).columns = 100;
    const terminal = new TtyTerminal(streamString.writeStream);
    const progress = new Progress(terminal, new TtyStyler(3));

    const handle = progress.add("bytes", "Hashing file.mxf", 20_641_497_116, 0);
    progress.update(handle, 13_817_151_488);
    await sleep(150);
    const output = streamString.getString();
    const plain = Bun.stripANSI(output);
    const barLine = plain.split("\n")[1] ?? "";

    expect(barLine).toMatch(/\[[=-]+\]/);
    await progress.hide(handle);
  });

  test("time remaining shows '-' instead of an absurd/overflowing estimate once the rate decays near zero", async () => {
    const streamString = new StreamString();
    (streamString.writeStream as unknown as { columns: number }).columns = 120;
    const terminal = new TtyTerminal(streamString.writeStream);
    const progress = new Progress(terminal, new TtyStyler(3));

    const realDateNow = Date.now;
    let fakeNow = 1_000_000;
    Date.now = () => fakeNow;

    let handle!: number;
    try {
      handle = progress.add("bytes", "downloading", 10_000_000_000, 0);
      // Establish a fast initial rate.
      fakeNow += 100;
      progress.update(handle, 1_000_000);
      // Then stall completely - repeated same-value updates decay the smoothed rate toward
      // zero without ever hitting exactly 0, which used to produce a "time remaining" of
      // several e+48 days (finite but nonsensical, rendered in exponential notation) or, once
      // the division overflowed past Number.MAX_VALUE, a literal Infinity/NaN.
      for (let i = 0; i < 40; i++) {
        fakeNow += 100;
        progress.update(handle, 1_000_000);
      }
    } finally {
      Date.now = realDateNow;
    }

    await sleep(150);
    const output = streamString.getString();
    const plain = Bun.stripANSI(output.slice(output.indexOf("time remaining:")));
    expect(plain).toContain("time remaining: -");
    expect(plain).not.toContain("Infinity");
    expect(plain).not.toContain("NaN");
    expect(plain).not.toMatch(/e\+\d+d/);
    await progress.hide(handle);
  });

  test("ProgressStyle enum has expected values", () => {
    expect(ProgressStyle.STROKE).toBe(ProgressStyle.STROKE);
    expect(ProgressStyle.FILL).toBe(ProgressStyle.FILL);
    expect(Object.keys(ProgressStyle)).toContain("STROKE");
    expect(Object.keys(ProgressStyle)).toContain("FILL");
  });
});
