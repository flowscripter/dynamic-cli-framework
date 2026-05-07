import { describe, expect, test } from "bun:test";
import ImagePrinterServiceProvider from "../../../src/service/imagePrinter/ImagePrinterServiceProvider.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

describe("ImagePrinterServiceProvider tests", () => {
  test("ImagePrinterServiceProvider provide works", async () => {
    const provider = new ImagePrinterServiceProvider(50);
    const cliConfig = getCLIConfig();
    const serviceInfo = await provider.provide(cliConfig);
    expect(serviceInfo.commands.length).toEqual(0);
    expect(serviceInfo.service).toBeDefined();
  });
});
