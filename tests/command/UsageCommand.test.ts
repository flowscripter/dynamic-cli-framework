import { Buffer } from "@std/streams";
import { assertEquals } from "@std/assert";
import DefaultContext from "../../src/runtime/DefaultContext.ts";
import UsageCommand from "../../src/command/UsageCommand.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";
import { PRINTER_SERVICE_ID } from "../../src/api/service/core/PrinterService.ts";
import DefaultPrinterService from "../../src/service/printer/DefaultPrinterService.ts";
import type { ArgumentValues } from "../../src/api/argument/ArgumentValueTypes.ts";
import type Context from "../../src/api/Context.ts";
import type Command from "../../src/api/command/Command.ts";

const decoder = new TextDecoder();

function expectBufferString(actual: Buffer, expected: string) {
  assertEquals(decoder.decode(actual.bytes()), expected);
}

Deno.test("Usage works", async () => {
  const buffer = new Buffer();
  const printer = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
  );
  printer.colorEnabled = false;

  const context = new DefaultContext(getCLIConfig());

  context.addServiceInstance(PRINTER_SERVICE_ID, printer);

  const usageCommand = new UsageCommand(
    new class implements Command {
      readonly name = "help";

      execute(
        _argumentValues: ArgumentValues,
        _context: Context,
      ): Promise<void> {
        return Promise.resolve(undefined);
      }
    }(),
  );

  await usageCommand.execute(context);

  expectBufferString(
    buffer,
    "Try running:\n\n  foo --help\n\n",
  );
});
