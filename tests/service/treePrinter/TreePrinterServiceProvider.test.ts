import { describe, expect, test } from "bun:test";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import TreePrinterServiceProvider from "../../../src/service/treePrinter/TreePrinterServiceProvider.ts";
import { PRINTER_SERVICE_ID } from "../../../src/api/service/core/PrinterService.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";
import StreamString from "../../fixtures/StreamString.ts";
import TtyTerminal from "../../../src/service/printer/terminal/TtyTerminal.ts";
import TtyStyler from "../../../src/service/printer/terminal/TtyStyler.ts";

describe("TreePrinterServiceProvider tests", () => {
  test("provide returns service and empty commands", async () => {
    const treePrinterServiceProvider = new TreePrinterServiceProvider(100);
    const cliConfig = getCLIConfig();

    const serviceInfo = await treePrinterServiceProvider.provide(cliConfig);
    expect(serviceInfo.commands.length).toEqual(0);
    expect(serviceInfo.service).toBeDefined();
  });

  test("initService sets colorEnabled and colorFunction from PrinterService", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const treePrinterServiceProvider = new TreePrinterServiceProvider(100);
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

    const serviceInfo = await treePrinterServiceProvider.provide(cliConfig);
    expect(serviceInfo.commands.length).toEqual(0);

    await treePrinterServiceProvider.initService(context);

    const service = serviceInfo
      .service as import("../../../src/service/treePrinter/DefaultTreePrinterService.ts").default;
    expect(service.colorEnabled).toBe(true);
    expect(typeof service.colorFunction).toBe("function");
  });
});
