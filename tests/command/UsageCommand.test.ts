import { describe, test } from "bun:test";
import DefaultContext from "../../src/runtime/DefaultContext.ts";
import UsageCommand from "../../src/command/UsageCommand.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";
import { PRINTER_SERVICE_ID } from "../../src/api/service/core/PrinterService.ts";
import DefaultPrinterService from "../../src/service/printer/DefaultPrinterService.ts";
import type { ArgumentValues } from "../../src/api/argument/ArgumentValueTypes.ts";
import type Context from "../../src/api/Context.ts";
import type Command from "../../src/api/command/Command.ts";
import StreamString from "../fixtures/StreamString.ts";
import { expectStringEquals } from "../fixtures/util.ts";
import TtyTerminal from "../../src/service/printer/terminal/TtyTerminal.ts";
import TtyStyler from "../../src/service/printer/terminal/TtyStyler.ts";

describe("UsageCommand Tests", () => {
  test("Usage works", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printer = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(),
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

    expectStringEquals(
      dummyStdout.getString(),
      "Try running:\n\n  foo --help\n\n",
    );
  });
});
