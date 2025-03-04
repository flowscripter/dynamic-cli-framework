import { describe, test } from "bun:test";
import DefaultContext from "../../src/runtime/DefaultContext.ts";
import VersionCommand from "../../src/command/VersionCommand.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";
import { PRINTER_SERVICE_ID } from "../../src/api/service/core/PrinterService.ts";
import DefaultPrinterService from "../../src/service/printer/DefaultPrinterService.ts";
import StreamString from "../fixtures/StreamString.ts";
import { expectStringEquals } from "../fixtures/util.ts";
import TtyTerminal from "../../src/service/printer/terminal/TtyTerminal.ts";
import TtyStyler from "../../src/service/printer/terminal/TtyStyler.ts";

describe("VersionCommand Tests", () => {
  test("Version works", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printer = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    printer.colorEnabled = false;

    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PRINTER_SERVICE_ID, printer);

    const versionCommand = new VersionCommand();

    await versionCommand.execute(context);

    expectStringEquals(dummyStdout.getString(), "foobar\n");
  });
});
