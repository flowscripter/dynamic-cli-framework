import { Buffer } from "@std/streams";
import { assertEquals } from "@std/assert";
import { assertSnapshot } from "@std/testing/snapshot";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import BannerServiceProvider from "../../../src/service/banner/BannerServiceProvider.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";
import { PRINTER_SERVICE_ID } from "../../../src/api/service/core/PrinterService.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { ASCII_BANNER_GENERATOR_SERVICE_ID } from "../../../src/api/service/core/AsciiBannerGeneratorService.ts";
import DefaultAsciiBannerGeneratorService from "../../../src/service/asciiBannerGenerator/DefaultAsciiBannerGeneratorService.ts";

const decoder = new TextDecoder();

Deno.test("BannerServiceProvider provide works", async () => {
  const bannerServiceProvider = new BannerServiceProvider(100);
  const serviceInfo = await bannerServiceProvider.provide(getCLIConfig());
  assertEquals(serviceInfo.commands.length, 1);
});

Deno.test("BannerServiceProvider initService works", async (t) => {
  const buffer = new Buffer();
  const printer = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
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

  assertEquals(bannerServiceProvider.printBanner, true);

  await assertSnapshot(t, decoder.decode(buffer.bytes()));
});
