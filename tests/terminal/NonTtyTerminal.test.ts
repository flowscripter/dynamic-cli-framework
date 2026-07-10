import { describe, expect, test } from "bun:test";
import NonTtyTerminal from "../../src/terminal/NonTtyTerminal.ts";
import StreamString from "../fixtures/StreamString.ts";
import { expectStringEquals } from "../fixtures/util.ts";

describe("NonTtyTerminal tests", () => {
  test("write() works", async () => {
    const dummy = new StreamString();
    const terminal = new NonTtyTerminal(dummy.writeStream);

    await terminal.write("hello world");

    expectStringEquals(dummy.getString(), "hello world");
  });

  test("columns() and rows() return defaults", () => {
    const dummy = new StreamString();
    const terminal = new NonTtyTerminal(dummy.writeStream);

    expect(terminal.columns()).toEqual(80);
    expect(terminal.rows()).toEqual(24);
  });

  test("isTty() returns false", () => {
    const dummy = new StreamString();
    const terminal = new NonTtyTerminal(dummy.writeStream);

    expect(terminal.isTty()).toBeFalse();
  });

  test("clearLine() throws", () => {
    const dummy = new StreamString();
    const terminal = new NonTtyTerminal(dummy.writeStream);

    expect(terminal.clearLine()).rejects.toThrow(
      "clearLine() is not supported on a non-TTY terminal",
    );
  });

  test("clearUpLines() throws", () => {
    const dummy = new StreamString();
    const terminal = new NonTtyTerminal(dummy.writeStream);

    expect(terminal.clearUpLines(2)).rejects.toThrow(
      "clearUpLines() is not supported on a non-TTY terminal",
    );
  });

  test("hideCursor() throws", () => {
    const dummy = new StreamString();
    const terminal = new NonTtyTerminal(dummy.writeStream);

    expect(terminal.hideCursor()).rejects.toThrow(
      "hideCursor() is not supported on a non-TTY terminal",
    );
  });

  test("showCursor() throws", () => {
    const dummy = new StreamString();
    const terminal = new NonTtyTerminal(dummy.writeStream);

    expect(terminal.showCursor()).rejects.toThrow(
      "showCursor() is not supported on a non-TTY terminal",
    );
  });

  test("constructor throws if given a TTY stream", () => {
    const dummy = new StreamString();
    (dummy.writeStream as unknown as { isTTY: boolean }).isTTY = true;

    expect(() => new NonTtyTerminal(dummy.writeStream)).toThrow(
      "The provided WriteStream is a TTY",
    );
  });
});
