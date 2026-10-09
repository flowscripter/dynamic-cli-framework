import process from "node:process";
import { afterEach, describe, expect, test } from "bun:test";
import {
  isLinuxScriptInstall,
  upgradeViaLinuxScript,
} from "../../../../src/service/upgrade/method/linuxScript.ts";
import { getSpawnService } from "../../../fixtures/SpawnService.ts";

const location = { scriptUrl: "https://example.com/install.sh" };

describe("isLinuxScriptInstall", () => {
  const originalExecPath = process.execPath;

  afterEach(() => {
    process.execPath = originalExecPath;
  });

  test("is true only when running from /usr/local/bin", () => {
    process.execPath = "/usr/local/bin/example-cli";
    expect(isLinuxScriptInstall()).toBe(true);
    process.execPath = "/opt/other/example-cli";
    expect(isLinuxScriptInstall()).toBe(false);
  });
});

describe("upgradeViaLinuxScript", () => {
  test("pipes the install script into sh", async () => {
    const { spawnService, calls } = getSpawnService(() => ({ ok: true, exitCode: 0 }));
    await upgradeViaLinuxScript(spawnService, undefined, location);
    expect(calls[0]?.command).toEqual([
      "sh",
      "-c",
      "curl -fsSL https://example.com/install.sh | sh",
    ]);
  });

  test("fails when the install script fails", async () => {
    const { spawnService } = getSpawnService(() => ({ ok: false, exitCode: 2 }));
    await expect(upgradeViaLinuxScript(spawnService, undefined, location)).rejects.toThrow(
      "Install script failed: exit code 2",
    );
  });
});
