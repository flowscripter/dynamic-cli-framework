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
  checkResult: UpgradeCheckResult | undefined,
  upgradeResult?: UpgradeResult,
): DefaultUpgradeService {
  return {
    checkForUpgrade: () => Promise.resolve(checkResult),
    upgrade: () => Promise.resolve(upgradeResult!),
  } as unknown as DefaultUpgradeService;
}

function getContext(): { context: DefaultContext; messages: { info: string[]; error: string[] } } {
  const context = new DefaultContext(getCLIConfig());
  const messages = { info: [] as string[], error: [] as string[] };
  context.addServiceInstance(PRINTER_SERVICE_ID, {
    print: (msg: string) => {
      messages.info.push(msg);
      return Promise.resolve();
    },
    error: (msg: string) => {
      messages.error.push(msg);
      return Promise.resolve();
    },
  });
  return { context, messages };
}

describe("UpgradeSubCommand", () => {
  test("prints error when no upgrade location configured", async () => {
    const command = new UpgradeSubCommand(getUpgradeService(undefined));
    const { context, messages } = getContext();

    await command.execute(context, {});

    expect(messages.error[0]).toContain("No upgrade location is configured");
  });

  test("prints already up to date when no update available", async () => {
    const checkResult: UpgradeCheckResult = {
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

    expect(messages.info[0]).toContain("is already up to date (1.0.0)");
  });

  test("prints upgraded message on success", async () => {
    const checkResult: UpgradeCheckResult = {
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

    expect(messages.info[0]).toEqual(`${getCLIConfig().name} upgraded (1.0.0 -> 2.0.0)\n`);
  });

  test("prints error when upgrade fails", async () => {
    const checkResult: UpgradeCheckResult = {
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
