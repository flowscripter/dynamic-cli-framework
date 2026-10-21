import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { ReadStream } from "node:tty";
import TtyKeyReader from "../../src/terminal/TtyKeyReader.ts";

class FakeReadStream extends EventEmitter {
  isTTY = true;
  isRaw = false;
  paused = true;
  rawCalls: boolean[] = [];
  setRawMode(mode: boolean) {
    this.isRaw = mode;
    this.rawCalls.push(mode);
  }
  isPaused() {
    return this.paused;
  }
  resume() {
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
}

describe("TtyKeyReader readRaw tests", () => {
  test("resolves when complete and restores state", async () => {
    const stream = new FakeReadStream();
    const reader = new TtyKeyReader(stream as unknown as ReadStream);
    const promise = reader.readRaw((received) => received.endsWith("c"), 5000);
    expect(stream.isRaw).toBe(true);
    expect(stream.paused).toBe(false);
    stream.emit("data", "ab");
    stream.emit("data", Buffer.from("c"));
    expect(await promise).toEqual("abc");
    expect(stream.rawCalls).toEqual([true, false]);
    expect(stream.paused).toBe(true);
    expect(stream.listenerCount("data")).toBe(0);
  });

  test("resolves on timeout and restores state", async () => {
    const stream = new FakeReadStream();
    const reader = new TtyKeyReader(stream as unknown as ReadStream);
    expect(await reader.readRaw(() => false, 10)).toEqual("");
    expect(stream.rawCalls).toEqual([true, false]);
    expect(stream.paused).toBe(true);
  });

  test("leaves raw mode and resumed state as found", async () => {
    const stream = new FakeReadStream();
    stream.isRaw = true;
    stream.paused = false;
    const reader = new TtyKeyReader(stream as unknown as ReadStream);
    expect(await reader.readRaw(() => false, 10)).toEqual("");
    expect(stream.rawCalls).toEqual([true]);
    expect(stream.paused).toBe(false);
  });
});
