import { Buffer, describe, it } from "../../test_deps.ts";
import DefaultPrinter from "../../../src/service/core/DefaultPrinter.ts";
import { Icon, Level } from "../../../src/api/service/core/Printer.ts";
import {
  expectBufferBytesEquals,
  expectBufferStringEquals,
  expectBufferStringIncludes,
  sleep,
  write,
} from "../../fixtures/util.ts";

describe("DefaultPrinter", () => {
  it("Color disabled works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer, buffer);
    printer.colorEnabled = false;

    await printer.info(`hello ${printer.blue("world")}`);

    expectBufferStringEquals(buffer, "hello world");
  });

  it("Color enabled works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer, buffer);
    printer.colorEnabled = true;
    printer.darkMode = true;
    await printer.info(`hello ${printer.blue("world")}`);

    expectBufferBytesEquals(
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
        51,
        49,
        59,
        49,
        52,
        56,
        59,
        49,
        53,
        48,
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
        51,
        56,
        59,
        49,
        51,
        57,
        59,
        50,
        49,
        48,
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
        51,
        49,
        59,
        49,
        52,
        56,
        59,
        49,
        53,
        48,
        109,
        27,
        91,
        51,
        57,
        109,
      ]),
    );
  });

  it("stdout writable accessible", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer, buffer);
    printer.colorEnabled = false;

    await write(printer.stdout, "hello world");

    expectBufferStringEquals(buffer, "hello world");
  });

  it("stderr writable accessible", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer, buffer);
    printer.colorEnabled = false;

    await write(printer.stderr, "hello world");

    expectBufferStringEquals(buffer, "hello world");
  });

  it("Printing to stdout and stderr works", async () => {
    const stdoutBuffer = new Buffer();
    const stderrBuffer = new Buffer();
    const printer = new DefaultPrinter(stdoutBuffer, stderrBuffer);
    printer.colorEnabled = false;

    await printer.print("hello stdout\n");
    await printer.info("hello stderr\n");

    expectBufferStringEquals(stdoutBuffer, "hello stdout\n");
    expectBufferStringEquals(stderrBuffer, "hello stderr\n");
  });

  it("Level filtering works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer, buffer);
    printer.colorEnabled = false;

    await printer.debug("hello debug 1\n");
    await printer.info("hello info 1\n");
    await printer.warn("hello warn 1\n");

    expectBufferStringEquals(buffer, "hello info 1\nhello warn 1\n");

    await printer.setLevel(Level.WARN);

    await printer.debug("hello debug 2\n");
    await printer.info("hello info 2\n");
    await printer.warn("hello warn 2\n");

    expectBufferStringEquals(
      buffer,
      "hello info 1\nhello warn 1\nhello warn 2\n",
    );

    await printer.setLevel(Level.DEBUG);

    await printer.debug("hello debug 3\n");
    await printer.info("hello info 3\n");
    await printer.warn("hello warn 3\n");

    expectBufferStringEquals(
      buffer,
      "hello info 1\nhello warn 1\nhello warn 2\nhello debug 3\nhello info 3\nhello warn 3\n",
    );
  });

  it("Icons work", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer, buffer);
    printer.colorEnabled = false;

    await printer.info("hello info", Icon.INFORMATION);

    expectBufferStringEquals(
      buffer,
      "ℹ hello info",
    );
  });

  it("Spinner works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer, buffer);
    printer.colorEnabled = false;

    await printer.showSpinner("hello world");
    await sleep(150);
    await printer.hideSpinner();

    expectBufferBytesEquals(
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
        27,
        91,
        71,
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
        27,
        91,
        71,
        27,
        91,
        63,
        50,
        53,
        104,
      ]),
    );
  });

  it("Progress bar works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer, buffer);
    printer.colorEnabled = false;

    const handle = await printer.showProgressBar("bits", "foo", 150, 35);
    await sleep(50);
    await printer.updateProgressBar(handle, 50);
    await sleep(50);
    await printer.hideProgressBar(handle);
    expectBufferStringIncludes(
      buffer,
      "foo",
    );
    expectBufferStringIncludes(
      buffer,
      "bits",
    );
  });

  it("Multiple progress bars work", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer, buffer);
    printer.colorEnabled = false;

    const handle1 = await printer.showProgressBar("bits", "foo");
    await sleep(50);
    const handle2 = await printer.showProgressBar("megaflops", "bar");
    await sleep(50);
    await printer.updateProgressBar(handle1, 25, "foo1");
    await sleep(50);
    await printer.updateProgressBar(handle2, 50, "bar1");
    await sleep(50);
    await printer.hideProgressBar(handle1);
    await printer.hideProgressBar(handle2);
    expectBufferStringIncludes(
      buffer,
      "bits",
    );
    expectBufferStringIncludes(
      buffer,
      "megaflops",
    );
    expectBufferStringIncludes(
      buffer,
      "foo1",
    );
    expectBufferStringIncludes(
      buffer,
      "bar1",
    );
  });
});
