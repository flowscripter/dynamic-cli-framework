import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import createBannerStartupTask from "../../../src/startup/banner/bannerStartupTask.ts";
import DefaultPrinterService from "../../../src/service/printer/DefaultPrinterService.ts";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { ASCII_BANNER_GENERATOR_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultAsciiBannerGeneratorService from "../../../src/service/asciiBannerGenerator/DefaultAsciiBannerGeneratorService.ts";
import TtyTerminal from "../../../src/terminal/TtyTerminal.ts";
import StreamString from "../../fixtures/StreamString.ts";
import TtyStyler from "../../../src/terminal/TtyStyler.ts";
import { getConfigurationServiceProvider } from "../../fixtures/ConfigurationServiceProvider.ts";
import {
  CONFIGURATION_SERVICE_ID,
  PROMPTER_SERVICE_ID,
  SHUTDOWN_SERVICE_ID,
  UPGRADE_SERVICE_ID,
} from "@flowscripter/dynamic-cli-framework-api";
import type {
  CLIConfig,
  UpgradeCheckResult,
  UpgradeService,
} from "@flowscripter/dynamic-cli-framework-api";
import { InstallMethod, SupportedArch, SupportedOs } from "@flowscripter/dynamic-cli-framework-api";
import ConfigurationServiceProvider from "../../../src/service/configuration/ConfigurationServiceProvider.ts";
import KeyValueServiceProvider from "../../../src/service/configuration/KeyValueServiceProvider.ts";
import UpgradeServiceProvider, {
  createAutoUpgradeStartupTask,
} from "../../../src/service/upgrade/UpgradeServiceProvider.ts";
import { BANNER_STARTUP_TASK_ID } from "../../../src/startup/banner/bannerStartupTask.ts";

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

function getUpgradeServiceKeyValues(currentVersion: string) {
  return {
    "upgrade-status": "declined",
    "latest-version:homebrew": { version: "3.0.2", checkedAt: 1790779930775 },
    "upgrade-check-result": {
      status: "checked",
      currentVersion,
      latestVersion: "3.0.2",
      updateAvailable: true,
      os: "macos",
      arch: "arm64",
      installMethod: "homebrew",
    },
  };
}

// A plain UpgradeService implementation, so the banner can only reach it through the interface.
function getUpgradeService(
  cachedResult: UpgradeCheckResult | undefined,
  restartedFromVersion?: string,
): UpgradeService {
  const unsupported: UpgradeCheckResult = { status: "unsupported" };
  return {
    detectOs: () => undefined,
    detectArch: () => undefined,
    detectInstallMethod: () => Promise.resolve(undefined),
    checkForUpgrade: () => Promise.resolve(unsupported),
    upgrade: () => Promise.resolve({ ok: false, oldVersion: "1.0.0" }),
    getUpgradeCheckResult: () => Promise.resolve(unsupported),
    getCachedUpgradeCheckResult: () => Promise.resolve(cachedResult),
    refreshUpgradeCheckCache: () => Promise.resolve(unsupported),
    restartedFromVersion,
  };
}

// Wires the real configuration, key-value and upgrade providers against a config file on disk,
// with each task run under its own scoped Context the same way runner.ts does. The banner runs
// before the auto-upgrade task, whose prompt is answered "No". Returns the printed output and the
// resulting upgrade-status in the upgrade service's own key-value scope.
async function runBannerWithPersistedUpgradeState(cliConfig: CLIConfig, cachedVersion: string) {
  const { dummyStderr, printer } = getPrinterAndStreams();
  const context = new DefaultContext(cliConfig);
  context.addServiceInstance(PRINTER_SERVICE_ID, printer);
  context.addServiceInstance(
    ASCII_BANNER_GENERATOR_SERVICE_ID,
    new DefaultAsciiBannerGeneratorService(),
  );
  context.addServiceInstance(SHUTDOWN_SERVICE_ID, {
    registerTask: () => {},
    enterLongRunningMode: () => {},
    leaveLongRunningMode: () => {},
    interrupt: () => {},
    isShutdownRequested: false,
  });
  context.addServiceInstance(PROMPTER_SERVICE_ID, {
    promptEnabled: true,
    prompt: () => Promise.resolve({ name: "enable-upgrade", value: false }),
    promptAll: () => Promise.resolve([]),
  });

  const configurationServiceProvider = new ConfigurationServiceProvider(90, false, true);
  const keyValueServiceProvider = new KeyValueServiceProvider(
    89,
    configurationServiceProvider,
    true,
  );
  const upgradeServiceProvider = new UpgradeServiceProvider(56, { supportedPlatforms: [] });

  const configFolder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
  const configLocation = path.join(configFolder, "config.json");
  configurationServiceProvider.setConfigLocation(configLocation);
  await fs.writeFile(
    configLocation,
    JSON.stringify({
      "key-values": {
        services: { [UPGRADE_SERVICE_ID]: getUpgradeServiceKeyValues(cachedVersion) },
      },
    }),
  );

  for (const provider of [
    configurationServiceProvider,
    keyValueServiceProvider,
    upgradeServiceProvider,
  ]) {
    const { service } = await provider.getServiceInfo(cliConfig);
    if (service) {
      context.addServiceInstance(provider.serviceId, service);
    }
  }
  for (const provider of [
    configurationServiceProvider,
    keyValueServiceProvider,
    upgradeServiceProvider,
  ]) {
    await provider.initService(
      keyValueServiceProvider.getContextForScope(context, "service", provider.serviceId),
    );
  }

  await createBannerStartupTask(50).run(
    keyValueServiceProvider.getContextForScope(context, "service", BANNER_STARTUP_TASK_ID),
  );
  const autoUpgradeTask = createAutoUpgradeStartupTask(upgradeServiceProvider, 10);
  await autoUpgradeTask.run(
    keyValueServiceProvider.getContextForScope(context, "service", autoUpgradeTask.id),
  );
  const upgradeStatus = await keyValueServiceProvider
    .getScopedKeyValueService("service", UPGRADE_SERVICE_ID)
    .get("upgrade-status");

  await fs.rm(configFolder, { recursive: true, force: true });
  return { output: dummyStderr.getString(), upgradeStatus };
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
    const { service: configurationService } = await configurationServiceProvider.getServiceInfo(
      getCLIConfig("mpeg-sdl-tool"),
    );
    context.addServiceInstance(CONFIGURATION_SERVICE_ID, configurationService!);

    const task = createBannerStartupTask(100, "small");
    await task.run(context);
    await printer.error("some text\n");

    expect(dummyStdout.getString()).toMatchSnapshot();
  });

  test("run() shows upgrade availability persisted in the upgrade service's own key-value scope", async () => {
    const { output, upgradeStatus } = await runBannerWithPersistedUpgradeState(
      { name: "example-cli", version: "3.0.1" },
      "3.0.1",
    );

    expect(output).toContain("version: 3.0.1 (3.0.2 available, run 'example-cli upgrade')");
    expect(upgradeStatus).toEqual("declined");
  });

  test("run() ignores a persisted upgrade check made by a different version", async () => {
    const { output } = await runBannerWithPersistedUpgradeState(
      { name: "example-cli", version: "3.0.2" },
      "3.0.1",
    );

    expect(output).toContain("version: 3.0.2\n");
    expect(output).not.toContain("available");
  });

  test("run() reads the cached upgrade check result through the UpgradeService interface", async () => {
    const { dummyStderr, printer } = getPrinterAndStreams();
    const context = new DefaultContext({ name: "example-cli", version: "3.0.1" });
    context.addServiceInstance(PRINTER_SERVICE_ID, printer);
    context.addServiceInstance(
      ASCII_BANNER_GENERATOR_SERVICE_ID,
      new DefaultAsciiBannerGeneratorService(),
    );
    context.addServiceInstance(
      UPGRADE_SERVICE_ID,
      getUpgradeService({
        status: "checked",
        currentVersion: "3.0.1",
        latestVersion: "3.0.2",
        updateAvailable: true,
        os: SupportedOs.MACOS,
        arch: SupportedArch.ARM64,
        installMethod: InstallMethod.HOMEBREW,
      }),
    );

    await createBannerStartupTask(50).run(context);

    expect(dummyStderr.getString()).toContain(
      "version: 3.0.1 (3.0.2 available, run 'example-cli upgrade')",
    );
  });

  test("run() prints nothing in a process restarted after an automatic upgrade", async () => {
    const { dummyStderr, printer } = getPrinterAndStreams();
    const context = new DefaultContext({ name: "example-cli", version: "3.0.2" });
    context.addServiceInstance(PRINTER_SERVICE_ID, printer);
    context.addServiceInstance(
      ASCII_BANNER_GENERATOR_SERVICE_ID,
      new DefaultAsciiBannerGeneratorService(),
    );
    context.addServiceInstance(UPGRADE_SERVICE_ID, getUpgradeService(undefined, "3.0.1"));

    await createBannerStartupTask(50).run(context);

    expect(dummyStderr.getString()).toEqual("");
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
