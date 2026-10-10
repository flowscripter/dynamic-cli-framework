import { describe, expect, test } from "bun:test";
import {
  getLatestWingetVersion,
  isWingetInstalled,
  upgradeViaWinget,
} from "../../../../src/service/upgrade/method/winget.ts";
import { getSpawnService } from "../../../fixtures/SpawnService.ts";

const location = { packageId: "Flowscripter.ExampleCli" };

describe("isWingetInstalled", () => {
  test("reflects the result of winget list", async () => {
    const installed = getSpawnService(() => ({ ok: true, exitCode: 0 }));
    expect(await isWingetInstalled(installed.spawnService, location)).toBe(true);
    expect(installed.calls[0]?.command).toEqual(["winget", "list", "--id", location.packageId]);

    const missing = getSpawnService(() => ({ ok: false, exitCode: 1 }));
    expect(await isWingetInstalled(missing.spawnService, location)).toBe(false);
  });

  test("is false without a SpawnService or location", async () => {
    const { spawnService } = getSpawnService(() => ({ ok: true, exitCode: 0 }));
    expect(await isWingetInstalled(undefined, location)).toBe(false);
    expect(await isWingetInstalled(spawnService, undefined)).toBe(false);
  });
});

describe("getLatestWingetVersion", () => {
  test("parses the version from winget show output", async () => {
    const { spawnService, calls } = getSpawnService(
      () => ({ ok: true, exitCode: 0 }),
      () => ["Found Example CLI", "Version: 9.9.9"],
    );
    expect(await getLatestWingetVersion(spawnService, location)).toEqual({
      ok: true,
      version: "9.9.9",
    });
    expect(calls[0]?.command).toEqual(["winget", "show", "--id", location.packageId]);
  });

  test("fails when not configured or without a SpawnService", async () => {
    const { spawnService } = getSpawnService(() => ({ ok: true, exitCode: 0 }));
    expect((await getLatestWingetVersion(spawnService, undefined)).ok).toBe(false);
    expect((await getLatestWingetVersion(undefined, location)).ok).toBe(false);
  });

  test("fails when winget show fails or its output has no version", async () => {
    const failing = getSpawnService(() => ({ ok: false, exitCode: 1 }));
    const failed = await getLatestWingetVersion(failing.spawnService, location);
    expect(!failed.ok && failed.error.message).toContain("winget show failed");

    const empty = getSpawnService(() => ({ ok: true, exitCode: 0 }));
    const unparsed = await getLatestWingetVersion(empty.spawnService, location);
    expect(!unparsed.ok && unparsed.error.message).toContain("Could not parse");
  });
});

describe("upgradeViaWinget", () => {
  test("runs winget upgrade silently accepting agreements", async () => {
    const { spawnService, calls } = getSpawnService(() => ({ ok: true, exitCode: 0 }));
    await upgradeViaWinget(spawnService, undefined, location);
    expect(calls[0]?.command).toEqual([
      "winget",
      "upgrade",
      "--id",
      location.packageId,
      "--silent",
      "--accept-package-agreements",
      "--accept-source-agreements",
    ]);
  });

  test("fails when winget upgrade fails", async () => {
    const { spawnService } = getSpawnService(() => ({ ok: false, exitCode: 1 }));
    await expect(upgradeViaWinget(spawnService, undefined, location)).rejects.toThrow(
      "winget upgrade failed",
    );
  });
});
