import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import {
  type DetectionInput,
  detectDarkBackground,
  parseColorFgBg,
  parseOsc11Reply,
} from "../../src/terminal/BackgroundDetector.ts";

class FakeInput extends EventEmitter {
  isTTY = true;
  isRaw = false;
  paused = true;
  rawCalls: boolean[] = [];
  constructor(private readonly replyOnWrite?: string[]) {
    super();
  }
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
  respond() {
    for (const reply of this.replyOnWrite ?? []) {
      this.emit("data", reply);
    }
  }
}

function fakeOutput(input: FakeInput) {
  const written: string[] = [];
  return {
    written,
    isTTY: true,
    write(data: string) {
      written.push(data);
      queueMicrotask(() => input.respond());
    },
  };
}

const DARK = "\x1b]11;rgb:0000/0000/0000\x07";
const LIGHT = "\x1b]11;rgb:ffff/ffff/ffff\x1b\\";
const DA1 = "\x1b[?62;4c";

describe("parseColorFgBg tests", () => {
  test("parses dark and light backgrounds", () => {
    expect(parseColorFgBg("15;0")).toBe(true);
    expect(parseColorFgBg("15;default;8")).toBe(true);
    expect(parseColorFgBg("0;15")).toBe(false);
    expect(parseColorFgBg("0;7")).toBe(false);
  });

  test("returns undefined when unparseable", () => {
    expect(parseColorFgBg(undefined)).toBeUndefined();
    expect(parseColorFgBg("0;default")).toBeUndefined();
    expect(parseColorFgBg("0;99")).toBeUndefined();
  });
});

describe("parseOsc11Reply tests", () => {
  test("parses BEL and ST terminated replies", () => {
    expect(parseOsc11Reply(DARK)).toBe(true);
    expect(parseOsc11Reply(LIGHT)).toBe(false);
  });

  test("parses 8 bit channels", () => {
    expect(parseOsc11Reply("\x1b]11;rgb:00/2b/36\x07")).toBe(true);
    expect(parseOsc11Reply("\x1b]11;rgb:fd/f6/e3\x07")).toBe(false);
  });

  test("returns undefined for garbage", () => {
    expect(parseOsc11Reply("junk")).toBeUndefined();
    expect(parseOsc11Reply("\x1b]11;rgb:zz/00/00\x07")).toBeUndefined();
  });
});

describe("detectDarkBackground tests", () => {
  test("skips when input is not a TTY", async () => {
    const input = new FakeInput();
    input.isTTY = false;
    const output = fakeOutput(input);
    expect(await detectDarkBackground(input as DetectionInput, output, {})).toBeUndefined();
    expect(output.written).toEqual([]);
  });

  test("skips when output is not a TTY", async () => {
    const input = new FakeInput();
    const output = { ...fakeOutput(input), isTTY: false };
    expect(await detectDarkBackground(input as DetectionInput, output, {})).toBeUndefined();
    expect(output.written).toEqual([]);
  });

  test("skips when TERM is dumb", async () => {
    const input = new FakeInput();
    const output = fakeOutput(input);
    expect(
      await detectDarkBackground(input as DetectionInput, output, { TERM: "dumb" }),
    ).toBeUndefined();
    expect(output.written).toEqual([]);
  });

  test("uses COLORFGBG without querying", async () => {
    const input = new FakeInput();
    const output = fakeOutput(input);
    expect(await detectDarkBackground(input as DetectionInput, output, { COLORFGBG: "0;15" })).toBe(
      false,
    );
    expect(output.written).toEqual([]);
  });

  test("reads OSC 11 reply and restores terminal state", async () => {
    const input = new FakeInput([DARK, DA1]);
    const output = fakeOutput(input);
    expect(await detectDarkBackground(input as DetectionInput, output, {})).toBe(true);
    expect(input.rawCalls).toEqual([true, false]);
    expect(input.paused).toBe(true);
    expect(input.listenerCount("data")).toBe(0);
  });

  test("detects light background", async () => {
    const input = new FakeInput([LIGHT, DA1]);
    expect(await detectDarkBackground(input as DetectionInput, fakeOutput(input), {})).toBe(false);
  });

  test("DA1 only reply means unsupported", async () => {
    const input = new FakeInput([DA1]);
    expect(
      await detectDarkBackground(input as DetectionInput, fakeOutput(input), {}, 5000),
    ).toBeUndefined();
  });

  test("no reply times out and restores terminal state", async () => {
    const input = new FakeInput([]);
    expect(
      await detectDarkBackground(input as DetectionInput, fakeOutput(input), {}, 20),
    ).toBeUndefined();
    expect(input.rawCalls).toEqual([true, false]);
    expect(input.paused).toBe(true);
    expect(input.listenerCount("data")).toBe(0);
  });

  test("garbage reply yields undefined", async () => {
    const input = new FakeInput(["garbage", DA1]);
    expect(
      await detectDarkBackground(input as DetectionInput, fakeOutput(input), {}),
    ).toBeUndefined();
  });
});
