import { describe, expect, test } from "bun:test";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import ThemeCommand from "../../../../src/service/printer/command/ThemeCommand.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import PrinterServiceProvider from "../../../../src/service/printer/PrinterServiceProvider.ts";
import ShutdownServiceProvider from "../../../../src/service/shutdown/ShutdownServiceProvider.ts";
import { PRINTER_SERVICE_ID, SHUTDOWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import TtyTerminal from "../../../../src/terminal/TtyTerminal.ts";
import StreamString from "../../../fixtures/StreamString.ts";
import DefaultPrinterService from "../../../../src/service/printer/DefaultPrinterService.ts";
import TtyStyler from "../../../../src/terminal/TtyStyler.ts";

async function setup(colorEnabled = true) {
  const streamString = new StreamString();
  const printerService = new DefaultPrinterService(
    streamString.writableStream,
    streamString.writableStream,
    true,
    true,
    new TtyTerminal(streamString.writeStream),
    new TtyTerminal(streamString.writeStream),
    new TtyStyler(3),
  );
  printerService.colorEnabled = colorEnabled;
  const printerServiceProvider = new PrinterServiceProvider(100, printerService);
  const cliConfig = getCLIConfig();
  const context = new DefaultContext(cliConfig);

  const shutdownServiceProvider = new ShutdownServiceProvider(1);
  const shutdownService = (await shutdownServiceProvider.getServiceInfo(cliConfig)).service!;
  context.addServiceInstance(SHUTDOWN_SERVICE_ID, shutdownService);
  context.addServiceInstance(PRINTER_SERVICE_ID, printerService);
  await printerServiceProvider.getServiceInfo(cliConfig);
  return { printerService, context };
}

describe("ThemeCommand tests", () => {
  test("execute sets darkMode for dark and light", async () => {
    const { printerService, context } = await setup();
    const command = new ThemeCommand(100, () => Promise.reject(new Error("unexpected")));

    await command.execute(context, "light");
    expect(printerService.darkMode).toEqual(false);

    await command.execute(context, "dark");
    expect(printerService.darkMode).toEqual(true);

    await ShutdownServiceProvider.shutdown();
  });

  test("auto uses detected light background", async () => {
    const { printerService, context } = await setup();
    await new ThemeCommand(100, () => Promise.resolve(false)).execute(context, "auto");
    expect(printerService.darkMode).toEqual(false);
    await ShutdownServiceProvider.shutdown();
  });

  test("auto uses detected dark background", async () => {
    const { printerService, context } = await setup();
    printerService.darkMode = false;
    await new ThemeCommand(100, () => Promise.resolve(true)).execute(context, "auto");
    expect(printerService.darkMode).toEqual(true);
    await ShutdownServiceProvider.shutdown();
  });

  test("auto falls back to dark when undetected", async () => {
    const { printerService, context } = await setup();
    printerService.darkMode = false;
    await new ThemeCommand(100, () => Promise.resolve(undefined)).execute(context, "auto");
    expect(printerService.darkMode).toEqual(true);
    await ShutdownServiceProvider.shutdown();
  });

  test("auto skips detection when color is disabled", async () => {
    const { printerService, context } = await setup(false);
    printerService.darkMode = false;
    const command = new ThemeCommand(100, () => Promise.reject(new Error("unexpected")));
    await command.execute(context, "auto");
    expect(printerService.darkMode).toEqual(true);
    await ShutdownServiceProvider.shutdown();
  });

  test("argument defaults to auto with allowable values", () => {
    const command = new ThemeCommand(100);
    expect(command.name).toEqual("theme");
    expect(command.argument.defaultValue).toEqual("auto");
    expect(command.argument.allowableValues).toEqual(["auto", "dark", "light"]);
  });
});
