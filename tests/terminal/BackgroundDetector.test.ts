import { describe, expect, test } from "bun:test";
import type KeyReader from "../../src/terminal/KeyReader.ts";
import type Terminal from "../../src/terminal/Terminal.ts";
import {
  detectDarkBackground,
  parseColorFgBg,
  parseOsc11Reply,
} from "../../src/terminal/BackgroundDetector.ts";
import { QUERY_BACKGROUND_COLOR, QUERY_DEVICE_ATTRIBUTES } from "../../src/terminal/Ansi.ts";

class FakeKeyReader implements KeyReader {
  readRawCalls = 0;
  constructor(private readonly reply: string | Error) {}
  enableRawMode() {}
  disableRawMode() {}
  readKey() {
    return Promise.resolve({});
  }
  readRaw(isComplete: (received: string) => boolean, _timeoutMs: number) {
    this.readRawCalls++;
    if (this.reply instanceof Error) {
      return Promise.reject(this.reply);
    }
    expect(isComplete(this.reply)).toBe(this.reply.endsWith("c"));
    return Promise.resolve(this.reply);
  }
}

class FakeTerminal {
  written: string[] = [];
  constructor(private readonly tty = true) {}
  isTty() {
    return this.tty;
  }
  write(text: string) {
    this.written.push(text);
    return Promise.resolve();
  }
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
  const detect = (
    reader: FakeKeyReader,
    terminal: FakeTerminal,
    env: Record<string, string | undefined> = {},
  ) => detectDarkBackground(reader, terminal as unknown as Terminal, env);

  test("skips when terminal is not a TTY", async () => {
    const reader = new FakeKeyReader(DARK + DA1);
    const terminal = new FakeTerminal(false);
    expect(await detect(reader, terminal)).toBeUndefined();
    expect(terminal.written).toEqual([]);
    expect(reader.readRawCalls).toBe(0);
  });

  test("skips when TERM is dumb", async () => {
    const reader = new FakeKeyReader(DARK + DA1);
    const terminal = new FakeTerminal();
    expect(await detect(reader, terminal, { TERM: "dumb" })).toBeUndefined();
    expect(reader.readRawCalls).toBe(0);
  });

  test("uses COLORFGBG without querying", async () => {
    const reader = new FakeKeyReader(DARK + DA1);
    const terminal = new FakeTerminal();
    expect(await detect(reader, terminal, { COLORFGBG: "0;15" })).toBe(false);
    expect(terminal.written).toEqual([]);
    expect(reader.readRawCalls).toBe(0);
  });

  test("queries the terminal and reads the OSC 11 reply", async () => {
    const terminal = new FakeTerminal();
    expect(await detect(new FakeKeyReader(DARK + DA1), terminal)).toBe(true);
    expect(terminal.written).toEqual([QUERY_BACKGROUND_COLOR + QUERY_DEVICE_ATTRIBUTES]);
  });

  test("detects light background", async () => {
    expect(await detect(new FakeKeyReader(LIGHT + DA1), new FakeTerminal())).toBe(false);
  });

  test("DA1 only reply means unsupported", async () => {
    expect(await detect(new FakeKeyReader(DA1), new FakeTerminal())).toBeUndefined();
  });

  test("no reply yields undefined", async () => {
    expect(await detect(new FakeKeyReader(""), new FakeTerminal())).toBeUndefined();
  });

  test("garbage reply yields undefined", async () => {
    expect(await detect(new FakeKeyReader("garbage" + DA1), new FakeTerminal())).toBeUndefined();
  });

  test("read failure yields undefined", async () => {
    expect(await detect(new FakeKeyReader(new Error("boom")), new FakeTerminal())).toBeUndefined();
  });

  test("uses process.env by default", async () => {
    const reader = new FakeKeyReader("");
    const terminal = new FakeTerminal(false);
    expect(await detectDarkBackground(reader, terminal as unknown as Terminal)).toBeUndefined();
  });
});
