import { describe, expect, test } from "bun:test";
import ImagePrinterServiceProvider from "../../../src/service/imagePrinter/ImagePrinterServiceProvider.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import TtyTerminal from "../../../src/terminal/TtyTerminal.ts";
import WritableStreamString from "../../fixtures/StreamString.ts";

describe("ImagePrinterServiceProvider tests", () => {
  test("ImagePrinterServiceProvider provide works", async () => {
    const streamString = new WritableStreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const provider = new ImagePrinterServiceProvider(50, terminal);
    const cliConfig = getCLIConfig();
    const serviceInfo = await provider.provide(cliConfig);
    expect(serviceInfo.commands.length).toEqual(0);
    expect(serviceInfo.service).toBeDefined();
  });
});
