import { describe, test } from "bun:test";
import {
  expectBytesEquals,
  expectStringEquals,
  expectStringIncludes,
  sleep,
  write,
} from "../../fixtures/util.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";
import { Icon, Level } from "../../../src/api/service/core/PrinterService.ts";
import TtyTerminal from "../../../src/service/printer/terminal/TtyTerminal.ts";
import TtyStyler from "../../../src/service/printer/terminal/TtyStyler.ts";
import StreamString from "../../fixtures/StreamString.ts";

describe("DefaultPrinterService Tests", () => {
  test("Color disabled works", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
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
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    printerService.colorEnabled = true;
    printerService.darkMode = true;
    await printerService.info(`hello ${printerService.blue("world")}`);
    expectBytesEquals(
      dummyStderr.getString(),
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
        57,
        109,
        27,
        91,
        51,
        57,
        109,
      ]),
    );
  });

  test("stdout writable accessible", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
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
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    printerService.colorEnabled = false;

    await printerService.print("hello stdout\n");
    await printerService.info("hello stderr\n");

    expectStringEquals(
      dummyStdout.getString(),
      "hello stdout\n",
    );
    expectStringEquals(
      dummyStderr.getString(),
      "hello stderr\n",
    );
  });

  test("Level filtering works", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    printerService.colorEnabled = false;

    await printerService.debug("hello debug 1\n");
    await printerService.info("hello info 1\n");
    await printerService.warn("hello warn 1\n");

    expectStringEquals(
      dummyStderr.getString(),
      "hello info 1\nhello warn 1\n",
    );

    await printerService.setLevel(Level.WARN);

    await printerService.debug("hello debug 2\n");
    await printerService.info("hello info 2\n");
    await printerService.warn("hello warn 2\n");

    expectStringEquals(
      dummyStderr.getString(),
      "hello info 1\nhello warn 1\nhello warn 2\n",
    );

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
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    printerService.colorEnabled = false;

    await printerService.info("hello info", Icon.INFORMATION);

    expectStringEquals(
      dummyStderr.getString(),
      "ℹ hello info",
    );

    await printerService.info("hello success", Icon.SUCCESS);

    expectStringEquals(
      dummyStderr.getString(),
      "ℹ hello info✔ hello success",
    );
  });

  test("Icons work on stdout", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    printerService.colorEnabled = false;

    await printerService.print("hello info", Icon.INFORMATION);

    expectStringEquals(
      dummyStdout.getString(),
      "ℹ hello info",
    );

    await printerService.print("hello success", Icon.SUCCESS);

    expectStringEquals(
      dummyStdout.getString(),
      "ℹ hello info✔ hello success",
    );
  });

  test("Spinner works", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
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

  test("Progress bar works", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    printerService.colorEnabled = false;

    const handle = await printerService.showProgressBar("bits", "foo", 150, 35);
    await sleep(50);
    printerService.updateProgressBar(handle, 50);
    await sleep(50);
    await printerService.hideProgressBar(handle);
    expectStringIncludes(
      dummyStderr.getString(),
      "foo",
    );
    expectStringIncludes(
      dummyStderr.getString(),
      "bits",
    );
  });

  test("Multiple progress bars work", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printerService = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
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
    expectStringIncludes(
      dummyStderr.getString(),
      "bits",
    );
    expectStringIncludes(
      dummyStderr.getString(),
      "megaflops",
    );
    expectStringIncludes(
      dummyStderr.getString(),
      "foo1",
    );
    expectStringIncludes(
      dummyStderr.getString(),
      "bar1",
    );
  });
});
