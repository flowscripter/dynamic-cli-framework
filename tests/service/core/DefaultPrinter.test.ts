import {
  assertEquals,
  Buffer,
  conversions,
  describe,
  it,
} from "../../test_deps.ts";
import DefaultPrinter from "../../../src/service/core/DefaultPrinter.ts";
import { Icon, Level } from "../../../src/api/service/core/Printer.ts";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function expectBufferString(actual: Buffer, expected: string) {
  const decoder = new TextDecoder();
  assertEquals(decoder.decode(actual.bytes()), expected);
}

function expectBufferBytes(actual: Buffer, expected: Uint8Array) {
  assertEquals(actual.bytes(), expected);
}

async function write(writable: WritableStream, message: string) {
  const contentBytes = new TextEncoder().encode(message);
  await conversions.writeAll(
    conversions.writerFromStreamWriter(writable.getWriter()),
    contentBytes,
  );
}

describe("DefaultPrinter", () => {
  it("Color disabled works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer);
    printer.colorEnabled = false;

    await printer.info(`hello ${printer.blue("world")}`);

    expectBufferString(buffer, "hello world");
  });

  it("Color enabled works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer);
    printer.colorEnabled = true;

    await printer.info(`hello ${printer.blue("world")}`);

    expectBufferBytes(
      buffer,
      new Uint8Array([
        27,
        91,
        51,
        56,
        59,
        50,
        59,
        49,
        50,
        56,
        59,
        49,
        50,
        56,
        59,
        49,
        50,
        56,
        109,
        104,
        101,
        108,
        108,
        111,
        32,
        27,
        91,
        51,
        56,
        59,
        50,
        59,
        48,
        59,
        49,
        51,
        53,
        59,
        50,
        53,
        53,
        109,
        119,
        111,
        114,
        108,
        100,
        27,
        91,
        51,
        56,
        59,
        50,
        59,
        49,
        50,
        56,
        59,
        49,
        50,
        56,
        59,
        49,
        50,
        56,
        109,
        27,
        91,
        51,
        57,
        109,
      ]),
    );
  });

  it("Writable accessible", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer);
    printer.colorEnabled = false;

    await write(printer.writable, "hello world");

    expectBufferString(buffer, "hello world");
  });

  it("Level filtering works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer);
    printer.colorEnabled = false;

    await printer.debug("hello debug 1\n");
    await printer.info("hello info 1\n");
    await printer.warn("hello warn 1\n");

    expectBufferString(buffer, "hello info 1\nhello warn 1\n");

    printer.setLevel(Level.WARN);

    await printer.debug("hello debug 2\n");
    await printer.info("hello info 2\n");
    await printer.warn("hello warn 2\n");

    expectBufferString(buffer, "hello info 1\nhello warn 1\nhello warn 2\n");

    printer.setLevel(Level.DEBUG);

    await printer.debug("hello debug 3\n");
    await printer.info("hello info 3\n");
    await printer.warn("hello warn 3\n");

    expectBufferString(
      buffer,
      "hello info 1\nhello warn 1\nhello warn 2\nhello debug 3\nhello info 3\nhello warn 3\n",
    );
  });

  it("Icons work", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer);
    printer.colorEnabled = false;

    await printer.info("hello info", Icon.INFORMATION);

    expectBufferString(
      buffer,
      "ℹ hello info",
    );
  });

  it("Spinner works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer);
    printer.colorEnabled = false;

    await printer.showSpinner("hello world");
    await sleep(150);
    await printer.hideSpinner();

    expectBufferBytes(
      buffer,
      new Uint8Array([
        27,
        91,
        63,
        50,
        53,
        108,
        27,
        91,
        50,
        75,
        13,
        226,
        160,
        139,
        32,
        104,
        101,
        108,
        108,
        111,
        32,
        119,
        111,
        114,
        108,
        100,
        27,
        91,
        50,
        75,
        13,
        27,
        91,
        63,
        50,
        53,
        104,
      ]),
    );
  });
});
