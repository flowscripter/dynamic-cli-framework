import { describe, expect, test } from "bun:test";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import BannerServiceProvider from "../../../src/service/banner/BannerServiceProvider.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";
import { PRINTER_SERVICE_ID } from "../../../src/api/service/core/PrinterService.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { ASCII_BANNER_GENERATOR_SERVICE_ID } from "../../../src/api/service/core/AsciiBannerGeneratorService.ts";
import DefaultAsciiBannerGeneratorService from "../../../src/service/asciiBannerGenerator/DefaultAsciiBannerGeneratorService.ts";
import TtyTerminal from "../../../src/service/printer/terminal/TtyTerminal.ts";
import StreamString from "../../fixtures/StreamString.ts";
import TtyStyler from "../../../src/service/printer/terminal/TtyStyler.ts";

describe("BannerServiceProvider tests", () => {
  test("BannerServiceProvider provide works", async () => {
    const bannerServiceProvider = new BannerServiceProvider(100);
    const serviceInfo = await bannerServiceProvider.provide(getCLIConfig());
    expect(serviceInfo.commands.length).toEqual(1);
  });

  test("BannerServiceProvider initService works", async () => {
    const dummyStdout = new StreamString();
    const dummyStderr = new StreamString();
    const printer = new DefaultPrinterService(
      dummyStdout.writableStream,
      dummyStderr.writableStream,
      true,
      true,
      new TtyTerminal(dummyStderr.writeStream),
      new TtyStyler(3),
    );
    printer.colorEnabled = false;

    const asciiBannerGenerator = new DefaultAsciiBannerGeneratorService();
    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PRINTER_SERVICE_ID, printer);
    context.addServiceInstance(
      ASCII_BANNER_GENERATOR_SERVICE_ID,
      asciiBannerGenerator,
    );

    const bannerServiceProvider = new BannerServiceProvider(100);
    await bannerServiceProvider.initService(context);

    expect(bannerServiceProvider.printBanner).toBeTrue();

    expect(dummyStdout.getString()).toMatchSnapshot();
  });
});
