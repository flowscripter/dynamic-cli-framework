import { assertEquals, Buffer, describe, it } from "../../test_deps.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import BannerServiceProvider from "../../../src/service/banner/BannerServiceProvider.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";
import { PRINTER_SERVICE_ID } from "../../../src/api/service/core/PrinterService.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";

function expectBufferString(actual: Buffer, expected: string) {
  const decoder = new TextDecoder();
  assertEquals(decoder.decode(actual.bytes()), expected);
}

describe("BannerServiceProvider", () => {
  it("BannerServiceProvider provide works", async () => {
    const bannerServiceProvider = new BannerServiceProvider(100);
    const serviceInfo = await bannerServiceProvider.provide(getCLIConfig());
    assertEquals(serviceInfo.commands.length, 1);
  });

  it("BannerServiceProvider initService works", async () => {
    const buffer = new Buffer();
    const printer = new DefaultPrinterService(buffer, buffer);
    printer.colorEnabled = false;

    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PRINTER_SERVICE_ID, printer);

    const bannerServiceProvider = new BannerServiceProvider(100);
    await bannerServiceProvider.initService(context);

    assertEquals(bannerServiceProvider.printBanner, true);

    expectBufferString(
      buffer,
      "\n" +
        "  _____    ___     ___  \n" +
        " |  ___|  / _ \\   / _ \\ \n" +
        " | |_    | | | | | | | |\n" +
        " |  _|   | |_| | | |_| |\n" +
        " |_|      \\___/   \\___/ \n" +
        "                        \n" +
        "  bar\n  version: foobar\n\n",
    );
  });
});
