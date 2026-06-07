import { describe, expect, test } from "bun:test";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import DarkModeCommand from "../../../../src/service/printer/command/DarkModeCommand.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import PrinterServiceProvider from "../../../../src/service/printer/PrinterServiceProvider.ts";
import ShutdownServiceProvider from "../../../../src/service/shutdown/ShutdownServiceProvider.ts";
import { SHUTDOWN_SERVICE_ID } from "../../../../src/api/service/core/ShutdownService.ts";
import TtyTerminal from "../../../../src/terminal/TtyTerminal.ts";
import StreamString from "../../../fixtures/StreamString.ts";
import DefaultPrinterService from "../../../../src/service/printer/DefaultPrinterService.ts";
import TtyStyler from "../../../../src/terminal/TtyStyler.ts";

describe("DarkModeCommand tests", () => {
  test("execute sets darkMode to true when argumentValue is true", async () => {
    const streamString = new StreamString();
    const printerService = new DefaultPrinterService(
      streamString.writableStream,
      streamString.writableStream,
      true,
      true,
      new TtyTerminal(streamString.writeStream),
      new TtyTerminal(streamString.writeStream),
      new TtyStyler(3),
    );
    const printerServiceProvider = new PrinterServiceProvider(100, printerService);
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);

    const shutdownServiceProvider = new ShutdownServiceProvider(1);
    const shutdownService = (await shutdownServiceProvider.getServiceInfo(cliConfig)).service!;
    context.addServiceInstance(SHUTDOWN_SERVICE_ID, shutdownService);

    await printerServiceProvider.getServiceInfo(cliConfig);

    const command = new DarkModeCommand(printerServiceProvider, 100);

    expect(printerServiceProvider.printerService!.darkMode).toEqual(false);

    await command.execute(context, true);

    expect(printerServiceProvider.printerService!.darkMode).toEqual(true);

    await ShutdownServiceProvider.shutdown();
  });

  test("execute sets darkMode to false when argumentValue is false", async () => {
    const streamString = new StreamString();
    const printerService = new DefaultPrinterService(
      streamString.writableStream,
      streamString.writableStream,
      true,
      true,
      new TtyTerminal(streamString.writeStream),
      new TtyTerminal(streamString.writeStream),
      new TtyStyler(3),
    );
    const printerServiceProvider = new PrinterServiceProvider(100, printerService);
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);

    const shutdownServiceProvider = new ShutdownServiceProvider(1);
    const shutdownService = (await shutdownServiceProvider.getServiceInfo(cliConfig)).service!;
    context.addServiceInstance(SHUTDOWN_SERVICE_ID, shutdownService);

    await printerServiceProvider.getServiceInfo(cliConfig);

    const command = new DarkModeCommand(printerServiceProvider, 100);

    await command.execute(context, false);

    expect(printerServiceProvider.printerService!.darkMode).toEqual(false);

    await ShutdownServiceProvider.shutdown();
  });
});
