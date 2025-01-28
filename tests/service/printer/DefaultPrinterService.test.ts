import { Buffer } from "@std/streams";
import {
  expectBufferBytesEquals,
  expectBufferStringEquals,
  expectBufferStringIncludes,
  sleep,
  write,
} from "../../fixtures/util.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";
import { Icon, Level } from "../../../src/api/service/core/PrinterService.ts";

Deno.test("Color disabled works", async () => {
  const buffer = new Buffer();
  const printerService = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
  );
  printerService.colorEnabled = false;

  await printerService.info(`hello ${printerService.blue("world")}`);

  expectBufferStringEquals(buffer, "hello world");
});

Deno.test("Color enabled works", async () => {
  const buffer = new Buffer();
  const printerService = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
  );
  printerService.colorEnabled = true;
  printerService.darkMode = true;
  await printerService.info(`hello ${printerService.blue("world")}`);

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

Deno.test("stdout writable accessible", async () => {
  const buffer = new Buffer();
  const printerService = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
  );
  printerService.colorEnabled = false;

  await write(printerService.stdoutWritable, "hello world");

  expectBufferStringEquals(buffer, "hello world");
});

Deno.test("stderr writable accessible", async () => {
  const buffer = new Buffer();
  const printerService = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
  );
  printerService.colorEnabled = false;

  await write(printerService.stderrWritable, "hello world");

  expectBufferStringEquals(buffer, "hello world");
});

Deno.test("Printing to stdout and stderr works", async () => {
  const stdoutBuffer = new Buffer();
  const stderrBuffer = new Buffer();
  const printerService = new DefaultPrinterService(
    stdoutBuffer.writable,
    stderrBuffer.writable,
  );
  printerService.colorEnabled = false;

  await printerService.print("hello stdout\n");
  await printerService.info("hello stderr\n");

  expectBufferStringEquals(stdoutBuffer, "hello stdout\n");
  expectBufferStringEquals(stderrBuffer, "hello stderr\n");
});

Deno.test("Level filtering works", async () => {
  const buffer = new Buffer();
  const printerService = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
  );
  printerService.colorEnabled = false;

  await printerService.debug("hello debug 1\n");
  await printerService.info("hello info 1\n");
  await printerService.warn("hello warn 1\n");

  expectBufferStringEquals(buffer, "hello info 1\nhello warn 1\n");

  await printerService.setLevel(Level.WARN);

  await printerService.debug("hello debug 2\n");
  await printerService.info("hello info 2\n");
  await printerService.warn("hello warn 2\n");

  expectBufferStringEquals(
    buffer,
    "hello info 1\nhello warn 1\nhello warn 2\n",
  );

  await printerService.setLevel(Level.DEBUG);

  await printerService.debug("hello debug 3\n");
  await printerService.info("hello info 3\n");
  await printerService.warn("hello warn 3\n");

  expectBufferStringEquals(
    buffer,
    "hello info 1\nhello warn 1\nhello warn 2\nhello debug 3\nhello info 3\nhello warn 3\n",
  );
});

Deno.test("Icons work on stderr", async () => {
  const buffer = new Buffer();
  const printerService = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
  );
  printerService.colorEnabled = false;

  await printerService.info("hello info", Icon.INFORMATION);

  expectBufferStringEquals(
    buffer,
    "ℹ hello info",
  );

  await printerService.info("hello success", Icon.SUCCESS);

  expectBufferStringEquals(
    buffer,
    "ℹ hello info✔ hello success",
  );
});

Deno.test("Icons work on stdout", async () => {
  const buffer = new Buffer();
  const printerService = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
  );
  printerService.colorEnabled = false;

  await printerService.print("hello info", Icon.INFORMATION);

  expectBufferStringEquals(
    buffer,
    "ℹ hello info",
  );

  await printerService.print("hello success", Icon.SUCCESS);

  expectBufferStringEquals(
    buffer,
    "ℹ hello info✔ hello success",
  );
});

Deno.test("Spinner works", async () => {
  const buffer = new Buffer();
  const printerService = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
  );
  printerService.colorEnabled = false;

  await printerService.showSpinner("hello world");
  await sleep(150);
  await printerService.hideSpinner();

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

Deno.test("Progress bar works", async () => {
  const buffer = new Buffer();
  const printerService = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
  );
  printerService.colorEnabled = false;

  const handle = await printerService.showProgressBar("bits", "foo", 150, 35);
  await sleep(50);
  printerService.updateProgressBar(handle, 50);
  await sleep(50);
  await printerService.hideProgressBar(handle);
  expectBufferStringIncludes(
    buffer,
    "foo",
  );
  expectBufferStringIncludes(
    buffer,
    "bits",
  );
});

Deno.test("Multiple progress bars work", async () => {
  const buffer = new Buffer();
  const printerService = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
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
