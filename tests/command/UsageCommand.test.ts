import { assertEquals, Buffer, describe, it } from "../test_deps.ts";
import DefaultContext from "../../src/runtime/DefaultContext.ts";
import UsageCommand from "../../src/command/UsageCommand.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";
import { PRINTER_SERVICE_ID } from "../../src/api/service/core/PrinterService.ts";
import DefaultPrinterService from "../../src/service/printer/DefaultPrinterService.ts";
import { ArgumentValues } from "../../src/api/argument/ArgumentValueTypes.ts";
import Context from "../../src/api/Context.ts";
import Command from "../../src/api/command/Command.ts";

function expectBufferString(actual: Buffer, expected: string) {
  const decoder = new TextDecoder();
  assertEquals(decoder.decode(actual.bytes()), expected);
}

describe("UsageCommand", () => {
  it("Usage works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinterService(buffer, buffer);
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
      "\nTry running:\n\n  foo --help\n\n",
    );
  });
});
