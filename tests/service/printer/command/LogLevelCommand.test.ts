import { Buffer } from "@std/streams";
import { assertEquals } from "@std/assert";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import LogLevelCommand from "../../../../src/service/printer/command/LogLevelCommand.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import PrinterServiceProvider from "../../../../src/service/printer/PrinterServiceProvider.ts";
import { Level } from "../../../../src/api/service/core/PrinterService.ts";
import ShutdownServiceProvider from "../../../../src/service/shutdown/ShutdownServiceProvider.ts";
import { SHUTDOWN_SERVICE_ID } from "../../../../src/api/service/core/ShutdownService.ts";

Deno.test("LogLevelCommand works", async () => {
  const buffer = new Buffer();
  const writer = buffer.writable;
  const printerServiceProvider = new PrinterServiceProvider(
    100,
    writer,
    writer,
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
    printerServiceProvider.printerService!.getLevel(),
    Level.INFO,
  );

  await logLevelCommand.execute(context, "ERROR");

  assertEquals(
    printerServiceProvider.printerService!.getLevel(),
    Level.ERROR,
  );

  await ShutdownServiceProvider.shutdown();
});
