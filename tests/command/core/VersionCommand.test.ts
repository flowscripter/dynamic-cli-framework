import { assertEquals, Buffer, describe, it } from "../../test_deps.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { PRINTER_SERVICE_ID } from "../../../src/api/service/core/Printer.ts";
import DefaultPrinter from "../../../src/service/core/DefaultPrinter.ts";
import VersionCommand from "../../../src/command/core/VersionCommand.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

function expectBufferString(actual: Buffer, expected: string) {
  const decoder = new TextDecoder();
  assertEquals(decoder.decode(actual.bytes()), expected);
}

describe("VersionCommand", () => {
  it("Version works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer, buffer);
    printer.colorEnabled = false;

    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PRINTER_SERVICE_ID, printer);

    const versionCommand = new VersionCommand();

    await versionCommand.execute({}, context);

    expectBufferString(
      buffer,
      "foobar\n",
    );
  });
});
