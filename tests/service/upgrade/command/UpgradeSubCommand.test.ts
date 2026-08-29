import { describe, expect, test } from "bun:test";
import type { UpgradeCheckResult, UpgradeResult } from "@flowscripter/dynamic-cli-framework-api";
import {
  InstallMethod,
  PRINTER_SERVICE_ID,
  SupportedArch,
  SupportedOs,
} from "@flowscripter/dynamic-cli-framework-api";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import { UpgradeSubCommand } from "../../../../src/service/upgrade/command/UpgradeSubCommand.ts";
import type DefaultUpgradeService from "../../../../src/service/upgrade/DefaultUpgradeService.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";

function getUpgradeService(
  checkResult: UpgradeCheckResult,
  upgradeResult?: UpgradeResult,
): DefaultUpgradeService {
  return {
    checkForUpgrade: () => Promise.resolve(checkResult),
    getUpgradeCheckResult: () => Promise.resolve(checkResult),
    upgrade: () => Promise.resolve(upgradeResult!),
  } as unknown as DefaultUpgradeService;
}

function getContext(): {
  context: DefaultContext;
  messages: { print: string[]; info: string[]; error: string[]; spinner: string[] };
} {
  const context = new DefaultContext(getCLIConfig());
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
  test("prints error when no upgrade location configured", async () => {
    const command = new UpgradeSubCommand(getUpgradeService({ status: "unsupported" }));
    const { context, messages } = getContext();

    await command.execute(context, {});

    expect(messages.error[0]).toContain("No upgrade location is configured");
  });

  test("prints error when the check failed", async () => {
    const command = new UpgradeSubCommand(
      getUpgradeService({ status: "failed", error: new Error("network error") }),
    );
    const { context, messages } = getContext();

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
    const command = new UpgradeSubCommand(getUpgradeService(checkResult));
    const { context, messages } = getContext();

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
    const command = new UpgradeSubCommand(getUpgradeService(checkResult, upgradeResult));
    const { context, messages } = getContext();

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
    const command = new UpgradeSubCommand(getUpgradeService(checkResult, upgradeResult));
    const { context, messages } = getContext();

    await command.execute(context, {});

    expect(messages.error[0]).toContain("boom");
  });
});
