import { describe, expect, test } from "bun:test";
import {
  expectBytesEquals,
  expectStringEquals,
  expectStringIncludes,
  sleep,
  write,
} from "../../fixtures/util.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";
import { Icon, Level } from "@flowscripter/dynamic-cli-framework-api";
import TtyTerminal from "../../../src/terminal/TtyTerminal.ts";
import NonTtyTerminal from "../../../src/terminal/NonTtyTerminal.ts";
import TtyStyler from "../../../src/terminal/TtyStyler.ts";
import StreamString from "../../fixtures/StreamString.ts";

describe("DefaultPrinterService tests", () => {
  test("Color disabled works", async () => {
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

    await printerService.info(`hello ${printerService.blue("world")}`);

    expectStringEquals(dummyStderr.getString(), "hello world");
  });

  test("Color enabled works", async () => {
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
    printerService.colorEnabled = true;
    printerService.darkMode = true;
    await printerService.info(`hello ${printerService.blue("world")}`);
    expectBytesEquals(
      dummyStderr.getString(),
      new Uint8Array([
        27, 91, 51, 56, 59, 50, 59, 49, 51, 49, 59, 49, 52, 56, 59, 49, 53, 48, 109, 104, 101, 108,
        108, 111, 32, 27, 91, 51, 56, 59, 50, 59, 51, 56, 59, 49, 51, 57, 59, 50, 49, 48, 109, 119,
        111, 114, 108, 100, 27, 91, 51, 57, 109, 27, 91, 51, 57, 109,
      ]),
    );
  });

  test("Custom color works", async () => {
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
    printerService.colorEnabled = true;
    await printerService.info(printerService.color("hello", "#000000"));
    expectBytesEquals(
      dummyStderr.getString(),
      new Uint8Array([
        27, 91, 51, 56, 59, 50, 59, 49, 48, 49, 59, 49, 50, 51, 59, 49, 51, 49, 109, 27, 91, 51, 56,
        59, 50, 59, 48, 59, 48, 59, 48, 109, 104, 101, 108, 108, 111, 27, 91, 51, 57, 109, 27, 91,
        51, 57, 109,
      ]),
    );
  });

  test("Custom color validation works", () => {
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
    printerService.colorEnabled = true;

    expect(() => printerService.color("hello", "foo")).toThrow("Invalid color: foo");
    expect(() => printerService.color("hello", "0x0")).toThrow("Invalid color: 0x0");
  });

  test("stdout writable accessible", async () => {
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

    await write(printerService.stdoutWritable, "hello world");

    expectStringEquals(dummyStdout.getString(), "hello world");
  });

  test("stderr writable accessible", async () => {
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

    await write(printerService.stderrWritable, "hello world");

    expectStringEquals(dummyStderr.getString(), "hello world");
  });

  test("Printing to stdout and stderr works", async () => {
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

    await printerService.print("hello stdout\n");
    await printerService.info("hello stderr\n");

    expectStringEquals(dummyStdout.getString(), "hello stdout\n");
    expectStringEquals(dummyStderr.getString(), "hello stderr\n");
  });

  test("Level filtering works", async () => {
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

    await printerService.debug("hello debug 1\n");
    await printerService.info("hello info 1\n");
    await printerService.warn("hello warn 1\n");

    expectStringEquals(dummyStderr.getString(), "hello info 1\nhello warn 1\n");

    await printerService.setLevel(Level.WARN);

    await printerService.debug("hello debug 2\n");
    await printerService.info("hello info 2\n");
    await printerService.warn("hello warn 2\n");

    expectStringEquals(dummyStderr.getString(), "hello info 1\nhello warn 1\nhello warn 2\n");

    await printerService.setLevel(Level.DEBUG);

    await printerService.debug("hello debug 3\n");
    await printerService.info("hello info 3\n");
    await printerService.warn("hello warn 3\n");

    expectStringEquals(
      dummyStderr.getString(),
      "hello info 1\nhello warn 1\nhello warn 2\nhello debug 3\nhello info 3\nhello warn 3\n",
    );
  });

  test("Icons work on stderr", async () => {
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

    await printerService.info("hello info", Icon.INFORMATION);

    expectStringEquals(dummyStderr.getString(), "ℹ hello info");

    await printerService.info("hello success", Icon.SUCCESS);

    expectStringEquals(dummyStderr.getString(), "ℹ hello info✔ hello success");
  });

  test("Icons work on stdout", async () => {
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

    await printerService.print("hello info", Icon.INFORMATION);

    expectStringEquals(dummyStdout.getString(), "ℹ hello info");

    await printerService.print("hello success", Icon.SUCCESS);

    expectStringEquals(dummyStdout.getString(), "ℹ hello info✔ hello success");
  });

  test("Spinner works", async () => {
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

    await printerService.showSpinner("hello world");
    await sleep(150);
    await printerService.hideSpinner();

    expectBytesEquals(
      dummyStderr.getString(),
      new Uint8Array([
        27, 91, 63, 50, 53, 108, 27, 91, 50, 75, 27, 91, 71, 226, 160, 139, 32, 104, 101, 108, 108,
        111, 32, 119, 111, 114, 108, 100, 27, 91, 50, 75, 27, 91, 71, 27, 91, 63, 50, 53, 104,
      ]),
    );
  });

  test("Progress bar works", async () => {
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

    const handle = await printerService.showProgressBar("bits", "foo", 150, 35);
    await sleep(50);
    printerService.updateProgressBar(handle, 50);
    await sleep(50);
    await printerService.hideProgressBar(handle);
    expectStringIncludes(dummyStderr.getString(), "foo");
    expectStringIncludes(dummyStderr.getString(), "bits");
  });

  test("Multiple progress bars work", async () => {
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

    const handle1 = await printerService.showProgressBar("bits", "foo");
    await sleep(50);
    const handle2 = await printerService.showProgressBar("megaflops", "bar");
    await sleep(50);
    printerService.updateProgressBar(handle1, 25, "foo1");
    await sleep(50);
    printerService.updateProgressBar(handle2, 50, "bar1");
    await sleep(50);
    await printerService.hideProgressBar(handle1);
    await printerService.hideProgressBar(handle2);
    expectStringIncludes(dummyStderr.getString(), "bits");
    expectStringIncludes(dummyStderr.getString(), "megaflops");
    expectStringIncludes(dummyStderr.getString(), "foo1");
    expectStringIncludes(dummyStderr.getString(), "bar1");
  });

  test("backgroundBlue with colorLevel 3 and colorEnabled produces background ANSI code", () => {
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
    printerService.colorEnabled = true;
    const result = printerService.backgroundBlue("text");
    expect(result).toStartWith("\x1b[48;2;");
    expect(result).toEndWith("\x1b[49m");
  });

  test("backgroundColor with colorLevel 3 produces background ANSI code", () => {
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
    printerService.colorEnabled = true;
    const result = printerService.backgroundColor("text", "#268bd2");
    expect(result).toStartWith("\x1b[48;2;");
    expect(result).toEndWith("\x1b[49m");
  });

  test("backgroundColor with invalid color throws", () => {
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
    printerService.colorEnabled = true;
    expect(() => printerService.backgroundColor("text", "invalid")).toThrow(
      "Invalid color: invalid",
    );
  });

  test("backgroundBlue with colorEnabled false returns plain text", () => {
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
    const result = printerService.backgroundBlue("text");
    expectStringEquals(result, "text");
  });

  test("all named background methods produce background ANSI codes when colorEnabled", () => {
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
    printerService.colorEnabled = true;
    for (const method of [
      "backgroundYellow",
      "backgroundOrange",
      "backgroundRed",
      "backgroundMagenta",
      "backgroundViolet",
      "backgroundBlue",
      "backgroundCyan",
      "backgroundGreen",
    ] as const) {
      const result = printerService[method]("text");
      expect(result).toStartWith("\x1b[48;2;");
      expect(result).toEndWith("\x1b[49m");
    }
  });

  test("all semantic background methods produce background ANSI codes when colorEnabled", () => {
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
    printerService.colorEnabled = true;
    for (const method of [
      "backgroundPrimary",
      "backgroundSecondary",
      "backgroundEmphasised",
      "backgroundSelected",
    ] as const) {
      const result = printerService[method]("text");
      expect(result).toStartWith("\x1b[48;2;");
      expect(result).toEndWith("\x1b[49m");
    }
  });

  test("hyperlinksEnabled defaults to true", () => {
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
    expect(printerService.hyperlinksEnabled).toBeTrue();
  });

  test("hyperlink with hyperlinksEnabled returns OSC 8 wrapped text", () => {
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
    const result = printerService.hyperlink("click here", "https://example.com");
    expect(result).toEqual("\x1b]8;;\x68ttps://example.com\x07click here\x1b]8;;\x07");
  });

  test("hyperlink with hyperlinksEnabled false returns url", () => {
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
    printerService.hyperlinksEnabled = false;
    const result = printerService.hyperlink("click here", "https://example.com");
    expect(result).toEqual("click here: https://example.com");
  });

  test("all background methods return plain text when colorEnabled is false", () => {
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
    for (const method of [
      "backgroundPrimary",
      "backgroundSecondary",
      "backgroundEmphasised",
      "backgroundSelected",
      "backgroundYellow",
      "backgroundOrange",
      "backgroundRed",
      "backgroundMagenta",
      "backgroundViolet",
      "backgroundBlue",
      "backgroundCyan",
      "backgroundGreen",
    ] as const) {
      expectStringEquals(printerService[method]("text"), "text");
    }
  });

  test("startQuote/endQuote prefixes lines at depth 1 on stderr", async () => {
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

    printerService.startQuote();
    await printerService.info("line1\nline2\n");
    printerService.endQuote();
    await printerService.info("line3\n");

    expectStringEquals(dummyStderr.getString(), "┐ line1\n│ line2\nline3\n");
  });

  test("nested startQuote/endQuote prefixes lines with branch column on stderr", async () => {
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

    printerService.startQuote();
    await printerService.info("outer1\n");
    printerService.startQuote();
    await printerService.info("inner1\ninner2\n");
    printerService.endQuote();
    await printerService.info("outer2\n");
    printerService.endQuote();

    expectStringEquals(dummyStderr.getString(), "┐ outer1\n├┐ inner1\n│ │ inner2\n│ outer2\n");
  });

  test("startQuote/endQuote does not affect print() (stdout)", async () => {
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

    printerService.startQuote();
    await printerService.print("line1\nline2\n");
    printerService.endQuote();

    expectStringEquals(dummyStdout.getString(), "line1\nline2\n");
  });

  test("startQuote prefixes still apply when stderr is a NonTtyTerminal", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStdout.writeStream),
      new NonTtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    printerService.colorEnabled = false;

    printerService.startQuote();
    await printerService.info("line1\nline2\n");
    printerService.endQuote();

    expectStringEquals(dummyStderr.getString(), "┐ line1\n│ line2\n");
  });

  test("endQuote() without startQuote() throws", () => {
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

    expect(() => printerService.endQuote()).toThrow(
      "endQuote() called without a matching startQuote()",
    );
  });

  test("startMark() while already marking throws", () => {
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

    printerService.startMark();
    expect(() => printerService.startMark()).toThrow("startMark() called while already marking");
  });

  test("endMark() without startMark() throws", () => {
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

    expect(() => printerService.endMark()).toThrow(
      "endMark() called without a matching startMark()",
    );
  });

  test("clearMarked() without endMark() throws", () => {
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

    expect(printerService.clearMarked()).rejects.toThrow(
      "clearMarked() called without a preceding endMark()",
    );
  });

  test("startMark/endMark/clearMarked erases the tracked rows on stderr", async () => {
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

    printerService.startMark();
    await printerService.info("line1\nline2\n");
    printerService.endMark();
    await printerService.clearMarked();

    expect(dummyStderr.getString()).toEqual(
      "line1\nline2\n" + "\x1b[1A\x1b[2K".repeat(2) + "\x1b[2K\x1b[G",
    );
  });

  test("startMark/endMark/clearMarked no-op when stderr is not a TTY", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStdout.writeStream),
      new NonTtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    printerService.colorEnabled = false;

    printerService.startMark();
    await printerService.info("line1\nline2\n");
    printerService.endMark();
    await printerService.clearMarked();

    expectStringEquals(dummyStderr.getString(), "line1\nline2\n");
  });

  test("startMark() while already marking throws even when stderr is not a TTY", () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStdout.writeStream),
      new NonTtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );

    printerService.startMark();
    expect(() => printerService.startMark()).toThrow("startMark() called while already marking");
  });

  test("showSpinner() no-ops when stderr is not a TTY", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStdout.writeStream),
      new NonTtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );

    await printerService.showSpinner("hello world");

    expectStringEquals(dummyStderr.getString(), "");
  });

  test("showProgressBar() no-ops and returns -1 when stderr is not a TTY", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStdout.writeStream),
      new NonTtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );

    const handle = await printerService.showProgressBar("bits", "foo", 100, 0);

    expect(handle).toEqual(-1);
    expectStringEquals(dummyStderr.getString(), "");
  });

  test("clearMarked() waits for the minimum display time", async () => {
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

    printerService.startMark();
    await printerService.info("line1\n");
    printerService.endMark();

    const start = Date.now();
    await printerService.clearMarked(100);
    expect(Date.now() - start).toBeGreaterThanOrEqual(90);
  });
});
