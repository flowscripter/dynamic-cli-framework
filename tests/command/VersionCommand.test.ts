import { describe, test } from "bun:test";
import DefaultContext from "../../src/runtime/DefaultContext.ts";
import VersionCommand from "../../src/command/VersionCommand.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";
import { PRINTER_SERVICE_ID, UPGRADE_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultPrinterService from "../../src/service/printer/DefaultPrinterService.ts";
import StreamString from "../fixtures/StreamString.ts";
import { expectStringEquals } from "../fixtures/util.ts";
import TtyTerminal from "../../src/terminal/TtyTerminal.ts";
import TtyStyler from "../../src/terminal/TtyStyler.ts";

describe("VersionCommand tests", () => {
  test("Version works", async () => {
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

    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PRINTER_SERVICE_ID, printer);

    const versionCommand = new VersionCommand();

    await versionCommand.execute(context);

    expectStringEquals(dummyStdout.getString(), "foobar\n");
  });

  test("Version shows available upgrade when UpgradeService reports one", async () => {
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

    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PRINTER_SERVICE_ID, printer);
    context.addServiceInstance(UPGRADE_SERVICE_ID, {
      getUpgradeCheckResult: () =>
        Promise.resolve({
          currentVersion: "foobar",
          latestVersion: "9.9.9",
          updateAvailable: true,
        }),
    });

    const versionCommand = new VersionCommand();

    await versionCommand.execute(context);

    expectStringEquals(dummyStdout.getString(), "foobar (9.9.9 available, run 'foo upgrade')\n");
  });

  test("Version omits upgrade line when no update available", async () => {
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

    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance(PRINTER_SERVICE_ID, printer);
    context.addServiceInstance(UPGRADE_SERVICE_ID, {
      getUpgradeCheckResult: () => Promise.resolve({ updateAvailable: false }),
    });

    const versionCommand = new VersionCommand();

    await versionCommand.execute(context);

    expectStringEquals(dummyStdout.getString(), "foobar\n");
  });
});
