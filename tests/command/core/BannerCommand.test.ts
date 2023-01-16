import { assertEquals, Buffer, describe, it } from "../../test_deps.ts";
import BannerCommand from "../../../src/command/core/BannerCommand.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import {
  AsciiBannerFont,
  PRINTER_SERVICE_ID,
} from "../../../src/api/service/core/Printer.ts";
import DefaultPrinter from "../../../src/service/core/DefaultPrinter.ts";
import { CONFIGURATION_SERVICE_ID } from "../../../src/api/service/core/Configuration.ts";
import DefaultConfiguration from "../../../src/service/core/DefaultConfiguration.ts";
import ConfigurationService from "../../../src/service/core/ConfigurationService.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

function expectBufferString(actual: Buffer, expected: string) {
  const decoder = new TextDecoder();
  assertEquals(decoder.decode(actual.bytes()), expected);
}

describe("BannerCommand", () => {
  it("Banner works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinter(buffer, buffer);
    printer.colorEnabled = false;

    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PRINTER_SERVICE_ID, printer);
    context.addServiceInstance(
      CONFIGURATION_SERVICE_ID,
      new DefaultConfiguration(new ConfigurationService(100)),
    );

    const bannerCommand = new BannerCommand(100);

    await bannerCommand.execute({ "font": AsciiBannerFont.STANDARD }, context);

    assertEquals(bannerCommand.printBanner, true);

    expectBufferString(
      buffer,
      "\n" +
        "  _____    ___     ___  \n" +
        " |  ___|  / _ \\   / _ \\ \n" +
        " | |_    | | | | | | | |\n" +
        " |  _|   | |_| | | |_| |\n" +
        " |_|      \\___/   \\___/ \n" +
        "                        \n" +
        "  bar\n  version: foobar\n  config: not initialized\n\n",
    );
  });
});
