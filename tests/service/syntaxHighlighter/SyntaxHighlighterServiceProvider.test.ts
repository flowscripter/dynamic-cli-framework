import { Buffer } from "@std/streams";
import { assertEquals } from "@std/assert";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import SyntaxHighlighterServiceProvider from "../../../src/service/syntaxHighlighter/SyntaxHighlighterServiceProvider.ts";
import { PRINTER_SERVICE_ID } from "../../../src/api/service/core/PrinterService.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";

Deno.test("SyntaxHighlighterServiceProvider provide and initService works", async () => {
  const buffer = new Buffer();
  const syntaxHighlighterServiceProvider = new SyntaxHighlighterServiceProvider(
    100,
  );
  const cliConfig = getCLIConfig();
  const context = new DefaultContext(cliConfig);

  context.addServiceInstance(
    PRINTER_SERVICE_ID,
    new DefaultPrinterService(
      buffer.writable,
      buffer.writable,
    ),
  );

  const serviceInfo = await syntaxHighlighterServiceProvider.provide(
    cliConfig,
  );
  assertEquals(serviceInfo.commands.length, 0);

  await syntaxHighlighterServiceProvider.initService(context);
});
