import { Buffer } from "@std/streams";
import { assertEquals } from "@std/assert";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import PrinterServiceProvider from "../../../src/service/printer/PrinterServiceProvider.ts";
import { SHUTDOWN_SERVICE_ID } from "../../../src/api/service/core/ShutdownService.ts";
import DefaultShutdownService from "../../../src/service/shutdown/DefaultShutdownService.ts";

Deno.test("PrinterServiceProvider provide works", async () => {
  const buffer = new Buffer();
  const printerServiceProvider = new PrinterServiceProvider(
    100,
    buffer.writable,
    buffer.writable,
  );
  const cliConfig = getCLIConfig();
  const context = new DefaultContext(cliConfig);

  context.addServiceInstance(
    SHUTDOWN_SERVICE_ID,
    new DefaultShutdownService(),
  );

  const serviceInfo = await printerServiceProvider.provide(cliConfig);
  assertEquals(serviceInfo.commands.length, 3);
});
