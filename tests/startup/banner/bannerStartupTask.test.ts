import { describe, expect, test } from "bun:test";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import createBannerStartupTask from "../../../src/startup/banner/bannerStartupTask.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";
import { KEY_VALUE_SERVICE_ID, PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { ASCII_BANNER_GENERATOR_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultAsciiBannerGeneratorService from "../../../src/service/asciiBannerGenerator/DefaultAsciiBannerGeneratorService.ts";
import TtyTerminal from "../../../src/terminal/TtyTerminal.ts";
import StreamString from "../../fixtures/StreamString.ts";
import TtyStyler from "../../../src/terminal/TtyStyler.ts";
import { getConfigurationServiceProvider } from "../../fixtures/ConfigurationServiceProvider.ts";
import { CONFIGURATION_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";

// FIGlet font is converted to a JSON string and embedded in a simple JSON file: `{ "font": "<figlet font definition>" }`
import smallFont from "../../service/asciiBannerGenerator/small.flf.json" with { type: "json" };

function getPrinterAndStreams() {
  const dummyStdout = new StreamString();
  const dummyStderr = new StreamString();
  const printer = new DefaultPrinterService(
    dummyStdout.writableStream,
    dummyStderr.writableStream,
    true,
    true,
    new TtyTerminal(dummyStdout.writeStream),
    new TtyTerminal(dummyStderr.writeStream),
    new TtyStyler(3),
  );
  printer.colorEnabled = false;
  return { dummyStdout, dummyStderr, printer };
}

describe("bannerStartupTask tests", () => {
  test("createBannerStartupTask returns a task with a modifier command", () => {
    const task = createBannerStartupTask(100);
    expect(task.modifierCommands?.length).toEqual(1);
    expect(task.priority).toEqual(100);
    expect(task.mode).toEqual("blocking");
  });

  test("run() prints the banner", async () => {
    const { dummyStderr, printer } = getPrinterAndStreams();
    const asciiBannerGenerator = new DefaultAsciiBannerGeneratorService();
    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PRINTER_SERVICE_ID, printer);
    context.addServiceInstance(ASCII_BANNER_GENERATOR_SERVICE_ID, asciiBannerGenerator);

    const task = createBannerStartupTask(100);
    await task.run(context);

    expect(dummyStderr.getString()).toMatchSnapshot();
  });

  test("run() with custom font name and config location works", async () => {
    const { dummyStdout, printer } = getPrinterAndStreams();
    const asciiBannerGenerator = new DefaultAsciiBannerGeneratorService();
    const context = new DefaultContext(getCLIConfig("mpeg-sdl-tool"));

    context.addServiceInstance(PRINTER_SERVICE_ID, printer);
    context.addServiceInstance(ASCII_BANNER_GENERATOR_SERVICE_ID, asciiBannerGenerator);

    asciiBannerGenerator.registerFont("small", smallFont.font);

    const configurationServiceProvider = getConfigurationServiceProvider(100, new Map());
    configurationServiceProvider.configLocation = "config.yaml";
    const { service: configurationService } =
      await configurationServiceProvider.getServiceInfo(getCLIConfig("mpeg-sdl-tool"));
    context.addServiceInstance(CONFIGURATION_SERVICE_ID, configurationService!);

    const task = createBannerStartupTask(100, "small");
    await task.run(context);
    await printer.error("some text\n");

    expect(dummyStdout.getString()).toMatchSnapshot();
  });

  test("run() shows upgrade availability when the KV cache has a checked/updateAvailable result", async () => {
    const { dummyStderr, printer } = getPrinterAndStreams();
    const asciiBannerGenerator = new DefaultAsciiBannerGeneratorService();
    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PRINTER_SERVICE_ID, printer);
    context.addServiceInstance(ASCII_BANNER_GENERATOR_SERVICE_ID, asciiBannerGenerator);
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, {
      has: () => Promise.resolve(true),
      get: () =>
        Promise.resolve({
          status: "checked",
          currentVersion: "foobar",
          latestVersion: "9.9.9",
          updateAvailable: true,
        }),
    });

    const task = createBannerStartupTask(100);
    await task.run(context);

    expect(dummyStderr.getString()).toContain(
      "version: foobar (9.9.9 available, run 'foo upgrade')",
    );
  });

  test("run() does nothing when the no-banner command has disabled it", async () => {
    const { dummyStderr, printer } = getPrinterAndStreams();
    const asciiBannerGenerator = new DefaultAsciiBannerGeneratorService();
    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PRINTER_SERVICE_ID, printer);
    context.addServiceInstance(ASCII_BANNER_GENERATOR_SERVICE_ID, asciiBannerGenerator);

    const task = createBannerStartupTask(100);
    const noBannerCommand = task.modifierCommands![0]!;
    await noBannerCommand.execute(context, true);
    await task.run(context);

    expect(dummyStderr.getString()).toEqual("");
  });
});
