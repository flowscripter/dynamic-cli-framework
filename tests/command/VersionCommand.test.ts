import { Buffer } from "@std/streams";
import { assertEquals } from "@std/assert";
import DefaultContext from "../../src/runtime/DefaultContext.ts";
import VersionCommand from "../../src/command/VersionCommand.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";
import { PRINTER_SERVICE_ID } from "../../src/api/service/core/PrinterService.ts";
import DefaultPrinterService from "../../src/service/printer/DefaultPrinterService.ts";

const decoder = new TextDecoder();

function expectBufferString(actual: Buffer, expected: string) {
  assertEquals(decoder.decode(actual.bytes()), expected);
}

Deno.test("Version works", async () => {
  const buffer = new Buffer();
  const printer = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
  );
  printer.colorEnabled = false;

  const context = new DefaultContext(getCLIConfig());

  context.addServiceInstance(PRINTER_SERVICE_ID, printer);

  const versionCommand = new VersionCommand();

  await versionCommand.execute(context);

  expectBufferString(
    buffer,
    "foobar\n",
  );
});
