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

  test("ProgressStyle enum has expected values", () => {
    expect(ProgressStyle.STROKE).toBe(ProgressStyle.STROKE);
    expect(ProgressStyle.FILL).toBe(ProgressStyle.FILL);
    expect(Object.keys(ProgressStyle)).toContain("STROKE");
    expect(Object.keys(ProgressStyle)).toContain("FILL");
  });
});
