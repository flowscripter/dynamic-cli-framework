import { describe, expect, test } from "bun:test";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import LogLevelCommand from "../../../../src/service/printer/command/LogLevelCommand.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import PrinterServiceProvider from "../../../../src/service/printer/PrinterServiceProvider.ts";
import { Level } from "../../../../src/api/service/core/PrinterService.ts";
import ShutdownServiceProvider from "../../../../src/service/shutdown/ShutdownServiceProvider.ts";
import { SHUTDOWN_SERVICE_ID } from "../../../../src/api/service/core/ShutdownService.ts";
import TtyTerminal from "../../../../src/service/printer/terminal/TtyTerminal.ts";
import StreamString from "../../../fixtures/StreamString.ts";
import DefaultPrinterService from "../../../../src/service/printer/DefaultPrinterService.ts";
import TtyStyler from "../../../../src/service/printer/terminal/TtyStyler.ts";

describe("LogLevelCommand tests", () => {
  test("LogLevelCommand works", async () => {
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

    const shutdownServiceProvider = new ShutdownServiceProvider(1);
    const shutdownService = (await shutdownServiceProvider.provide(cliConfig))
      .service!;

    context.addServiceInstance(SHUTDOWN_SERVICE_ID, shutdownService);

    await printerServiceProvider.provide(cliConfig);

    const logLevelCommand = new LogLevelCommand(printerServiceProvider, 100);

    expect(
      printerServiceProvider.printerService!.getLevel(),
    ).toEqual(
      Level.INFO,
    );

    await logLevelCommand.execute(context, "eRror");

    expect(
      printerServiceProvider.printerService!.getLevel(),
    ).toEqual(
      Level.ERROR,
    );

    await ShutdownServiceProvider.shutdown();
  });
});
