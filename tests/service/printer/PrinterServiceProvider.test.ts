import { describe, expect, test } from "bun:test";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import PrinterServiceProvider from "../../../src/service/printer/PrinterServiceProvider.ts";
import { SHUTDOWN_SERVICE_ID } from "../../../src/api/service/core/ShutdownService.ts";
import DefaultShutdownService from "../../../src/service/shutdown/DefaultShutdownService.ts";
import TtyTerminal from "../../../src/service/printer/terminal/TtyTerminal.ts";
import StreamString from "../../fixtures/StreamString.ts";
import TtyStyler from "../../../src/service/printer/terminal/TtyStyler.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";

describe("PrinterServiceProvider tests", () => {
  test("PrinterServiceProvider provide works", async () => {
    const streamString = new StreamString();
    const printerService = new DefaultPrinterService(
      streamString.writableStream,
      streamString.writableStream,
      true,
      true,
      new TtyTerminal(streamString.writeStream),
      new TtyStyler(3),
    );

    const printerServiceProvider = new PrinterServiceProvider(
      100,
      printerService,
    );
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);

    context.addServiceInstance(
      SHUTDOWN_SERVICE_ID,
      new DefaultShutdownService(),
    );

    const serviceInfo = await printerServiceProvider.provide(cliConfig);
    expect(serviceInfo.commands.length).toEqual(3);
  });
});
