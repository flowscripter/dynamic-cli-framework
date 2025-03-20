import { describe, expect, test } from "bun:test";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import PrettyPrinterServiceProvider from "../../../src/service/prettyPrinter/PrettyPrinterServiceProvider.ts";
import { PRINTER_SERVICE_ID } from "../../../src/api/service/core/PrinterService.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";
import StreamString from "../../fixtures/StreamString.ts";
import TtyTerminal from "../../../src/service/printer/terminal/TtyTerminal.ts";
import TtyStyler from "../../../src/service/printer/terminal/TtyStyler.ts";

describe("PrettyPrinterServiceProvider tests", () => {
  test("PrettyPrinterServiceProvider provide and initService works", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const prettyPrinterServiceProvider = new PrettyPrinterServiceProvider(
      100,
    );
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);

    context.addServiceInstance(
      PRINTER_SERVICE_ID,
      new DefaultPrinterService(
        dummyStdout.writableStream,
        dummyStderr.writableStream,
        true,
        true,
        new TtyTerminal(dummyStderr.writeStream),
        new TtyStyler(3),
      ),
    );

    const serviceInfo = await prettyPrinterServiceProvider.provide(
      cliConfig,
    );
    expect(serviceInfo.commands.length).toEqual(0);

    await prettyPrinterServiceProvider.initService(context);
  });
});
