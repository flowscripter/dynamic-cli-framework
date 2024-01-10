import { assertEquals, Buffer, describe, it } from "../../../test_deps.ts";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import LogLevelCommand from "../../../../src/service/printer/command/LogLevelCommand.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import PrinterServiceProvider from "../../../../src/service/printer/PrinterServiceProvider.ts";
import { Level } from "../../../../src/api/service/core/PrinterService.ts";
import ShutdownServiceProvider from "../../../../src/service/shutdown/ShutdownServiceProvider.ts";
import { SHUTDOWN_SERVICE_ID } from "../../../../src/api/service/core/ShutdownService.ts";

describe("LogLevelCommand", () => {
  it("LogLevelCommand works", async () => {
    const buffer = new Buffer();
    const printerServiceProvider = new PrinterServiceProvider(
      100,
      buffer,
      buffer,
    );
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);

    const shutdownServiceProvider = new ShutdownServiceProvider(1);
    const shutdownService = (await shutdownServiceProvider.provide(cliConfig))
      .service!;

    context.addServiceInstance(SHUTDOWN_SERVICE_ID, shutdownService);

    await printerServiceProvider.provide(cliConfig);

    const logLevelCommand = new LogLevelCommand(printerServiceProvider, 100);

    assertEquals(
      printerServiceProvider.defaultPrinterService!.getLevel(),
      Level.INFO,
    );

    await logLevelCommand.execute(context, "ERROR");

    assertEquals(
      printerServiceProvider.defaultPrinterService!.getLevel(),
      Level.ERROR,
    );

    ShutdownServiceProvider.shutdown();
  });
});
