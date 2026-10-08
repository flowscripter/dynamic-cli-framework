import { describe, expect, test } from "bun:test";
import type {
  UpgradeCheckResult,
  UpgradeResult,
  UpgradeService,
} from "@flowscripter/dynamic-cli-framework-api";
import {
  InstallMethod,
  PRINTER_SERVICE_ID,
  SupportedArch,
  SupportedOs,
  UPGRADE_SERVICE_ID,
} from "@flowscripter/dynamic-cli-framework-api";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import { UpgradeSubCommand } from "../../../../src/service/upgrade/command/UpgradeSubCommand.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";

function getUpgradeService(
  checkResult: UpgradeCheckResult,
  upgradeResult?: UpgradeResult,
): UpgradeService {
  return {
    detectOs: () => undefined,
    detectArch: () => undefined,
    detectInstallMethod: () => Promise.resolve(undefined),
    checkForUpgrade: () => Promise.resolve(checkResult),
    getUpgradeCheckResult: () => Promise.resolve(checkResult),
    getCachedUpgradeCheckResult: () => Promise.resolve(undefined),
    refreshUpgradeCheckCache: () => Promise.resolve(checkResult),
    upgrade: () => Promise.resolve(upgradeResult!),
    restartedFromVersion: undefined,
  };
}

function getContext(upgradeService: UpgradeService): {
  context: DefaultContext;
  messages: { print: string[]; info: string[]; error: string[]; spinner: string[] };
} {
  const context = new DefaultContext(getCLIConfig());
  context.addServiceInstance(UPGRADE_SERVICE_ID, upgradeService);
  const messages = {
    print: [] as string[],
    info: [] as string[],
    error: [] as string[],
    spinner: [] as string[],
  };
  context.addServiceInstance(PRINTER_SERVICE_ID, {
    print: (msg: string) => {
      messages.print.push(msg);
      return Promise.resolve();
    },
    info: (msg: string) => {
      messages.info.push(msg);
      return Promise.resolve();
    },
    error: (msg: string) => {
      messages.error.push(msg);
      return Promise.resolve();
    },
    showSpinner: (msg: string) => {
      messages.spinner.push(msg);
      return Promise.resolve();
    },
    hideSpinner: () => Promise.resolve(),
  });
  return { context, messages };
}

describe("UpgradeSubCommand", () => {
  test("offers an install method option and no operating system option", () => {
    const command = new UpgradeSubCommand();

    expect(command.options.map((option) => option.name)).toEqual(["install-method"]);
  });

  test("offers only the install methods applicable to the current platform", () => {
    const original = Object.getOwnPropertyDescriptor(process, "platform")!;
    const expected: Record<string, InstallMethod[]> = {
      darwin: [InstallMethod.HOMEBREW, InstallMethod.GITHUB_RELEASE],
      linux: [InstallMethod.LINUX_SCRIPT, InstallMethod.GITHUB_RELEASE],
      win32: [InstallMethod.WINGET, InstallMethod.GITHUB_RELEASE],
      freebsd: [InstallMethod.GITHUB_RELEASE],
    };
    try {
      for (const [platform, methods] of Object.entries(expected)) {
        Object.defineProperty(process, "platform", { value: platform });
        const option = new UpgradeSubCommand().options.find((o) => o.name === "install-method");
        expect(option?.allowableValues).toEqual(methods);
      }
    } finally {
      Object.defineProperty(process, "platform", original);
    }
  });

  test("passes only the install method override to checkForUpgrade and upgrade", async () => {
    const command = new UpgradeSubCommand();
    const checkArgs: unknown[][] = [];
    const upgradeArgs: unknown[][] = [];
    const checkResult: UpgradeCheckResult = {
      status: "checked",
      currentVersion: "1.0.0",
      latestVersion: "2.0.0",
      updateAvailable: true,
      os: SupportedOs.LINUX,
      arch: SupportedArch.X64,
      installMethod: InstallMethod.GITHUB_RELEASE,
    };
    const upgradeService: UpgradeService = {
      ...getUpgradeService(checkResult, { ok: true, oldVersion: "1.0.0", newVersion: "2.0.0" }),
      checkForUpgrade: (...args) => {
        checkArgs.push(args);
        return Promise.resolve(checkResult);
      },
      upgrade: (...args) => {
        upgradeArgs.push(args);
        return Promise.resolve({ ok: true, oldVersion: "1.0.0", newVersion: "2.0.0" });
      },
    };
    const { context } = getContext(upgradeService);

    await command.execute(context, { "install-method": InstallMethod.GITHUB_RELEASE });

    expect(checkArgs).toEqual([[InstallMethod.GITHUB_RELEASE]]);
    expect(upgradeArgs).toEqual([[InstallMethod.GITHUB_RELEASE]]);
  });

  test("prints error when no upgrade location configured", async () => {
    const command = new UpgradeSubCommand();
    const { context, messages } = getContext(getUpgradeService({ status: "unsupported" }));

    await command.execute(context, {});

    expect(messages.error[0]).toContain("No upgrade location is configured");
  });

  test("prints error when the check failed", async () => {
    const command = new UpgradeSubCommand();
    const { context, messages } = getContext(
      getUpgradeService({ status: "failed", error: new Error("network error") }),
    );

    await command.execute(context, {});

    expect(messages.error[0]).toContain("Failed to check for updates: network error");
  });

  test("prints already up to date when no update available", async () => {
    const checkResult: UpgradeCheckResult = {
      status: "checked",
      currentVersion: "1.0.0",
      latestVersion: "1.0.0",
      updateAvailable: false,
      os: SupportedOs.LINUX,
      arch: SupportedArch.X64,
      installMethod: InstallMethod.GITHUB_RELEASE,
    };
    const command = new UpgradeSubCommand();
    const { context, messages } = getContext(getUpgradeService(checkResult));

    await command.execute(context, {});

    expect(messages.spinner[0]).toContain("Looking for version newer than");
    expect(messages.print[0]).toContain("is already up to date: 1.0.0");
  });

  test("prints upgraded message on success", async () => {
    const checkResult: UpgradeCheckResult = {
      status: "checked",
      currentVersion: "1.0.0",
      latestVersion: "2.0.0",
      updateAvailable: true,
      os: SupportedOs.LINUX,
      arch: SupportedArch.X64,
      installMethod: InstallMethod.GITHUB_RELEASE,
    };
    const upgradeResult: UpgradeResult = { ok: true, oldVersion: "1.0.0", newVersion: "2.0.0" };
    const command = new UpgradeSubCommand();
    const { context, messages } = getContext(getUpgradeService(checkResult, upgradeResult));

    await command.execute(context, {});

    expect(messages.print[0]).toEqual(`${getCLIConfig().name} upgraded (1.0.0 -> 2.0.0)\n`);
  });

  test("prints error when upgrade fails", async () => {
    const checkResult: UpgradeCheckResult = {
      status: "checked",
      currentVersion: "1.0.0",
      latestVersion: "2.0.0",
      updateAvailable: true,
      os: SupportedOs.LINUX,
      arch: SupportedArch.X64,
      installMethod: InstallMethod.GITHUB_RELEASE,
    };
    const upgradeResult: UpgradeResult = {
      ok: false,
      oldVersion: "1.0.0",
      error: new Error("boom"),
    };
    const command = new UpgradeSubCommand();
    const { context, messages } = getContext(getUpgradeService(checkResult, upgradeResult));

    await command.execute(context, {});

    expect(messages.error[0]).toContain("boom");
  });
});
