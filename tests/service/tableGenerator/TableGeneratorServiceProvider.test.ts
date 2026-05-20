import { describe, expect, test } from "bun:test";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import TableGeneratorServiceProvider from "../../../src/service/tableGenerator/TableGeneratorServiceProvider.ts";
import { PRINTER_SERVICE_ID } from "../../../src/api/service/core/PrinterService.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";
import StreamString from "../../fixtures/StreamString.ts";
import TtyTerminal from "../../../src/service/printer/terminal/TtyTerminal.ts";
import TtyStyler from "../../../src/service/printer/terminal/TtyStyler.ts";

describe("TableGeneratorServiceProvider tests", () => {
  test("provide returns service and empty commands", async () => {
    const provider = new TableGeneratorServiceProvider(100);
    const cliConfig = getCLIConfig();
    const serviceInfo = await provider.provide(cliConfig);
    expect(serviceInfo.commands.length).toEqual(0);
    expect(serviceInfo.service).toBeDefined();
  });

  test("initService sets colorEnabled and colorFunction from PrinterService", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const provider = new TableGeneratorServiceProvider(100);
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);
    context.addServiceInstance(
      PRINTER_SERVICE_ID,
      new DefaultPrinterService(
        dummyStdout.writableStream,
        dummyStderr.writableStream,
        true,
        true,
        new TtyTerminal(dummyStdout.writeStream),
        new TtyTerminal(dummyStderr.writeStream),
        new TtyStyler(3),
      ),
    );
    const serviceInfo = await provider.provide(cliConfig);
    expect(serviceInfo.commands.length).toEqual(0);
    await provider.initService(context);
    const service = serviceInfo
      .service as import("../../../src/service/tableGenerator/DefaultTableGeneratorService.ts").default;
    expect(service.colorEnabled).toBe(true);
    expect(typeof service.colorFunction).toBe("function");
    expect(typeof service.backgroundColorFunction).toBe("function");
  });
});
