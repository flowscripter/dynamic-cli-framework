import process from "node:process";
import { rmSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SupportedArch, SupportedOs } from "@flowscripter/dynamic-cli-framework-api";
import type { FetchOptions } from "@flowscripter/dynamic-cli-framework-api";
import {
  getLatestGithubReleaseVersion,
  upgradeViaGithubRelease,
} from "../../../../src/service/upgrade/method/githubRelease.ts";
import { getFetchService, getSpawnService } from "./helpers.ts";

const location = {
  owner: "flowscripter",
  repo: "example-cli",
  assetPattern: "example-cli_{os}_{arch}.zip",
};

function githubReleaseRedirect(version: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location: `https://github.com/flowscripter/example-cli/releases/tag/v${version}` },
  });
}

describe("getLatestGithubReleaseVersion", () => {
  test("resolves the version from the latest release redirect", async () => {
    const fetchService = getFetchService(() => githubReleaseRedirect("9.9.9"));
    expect(await getLatestGithubReleaseVersion(fetchService, location)).toEqual({
      ok: true,
      version: "9.9.9",
    });
  });

  test("does not pass a timeoutMs to the lookup", async () => {
    let receivedOptions: FetchOptions | undefined;
    const fetchService = getFetchService((_input, options) => {
      receivedOptions = options;
      return githubReleaseRedirect("9.9.9");
    });
    await getLatestGithubReleaseVersion(fetchService, location);
    expect(receivedOptions?.timeoutMs).toBeUndefined();
  });

  test("fails when not configured or without a FetchService", async () => {
    const fetchService = getFetchService(() => githubReleaseRedirect("9.9.9"));
    expect((await getLatestGithubReleaseVersion(fetchService, undefined)).ok).toBe(false);
    expect((await getLatestGithubReleaseVersion(undefined, location)).ok).toBe(false);
  });

  test("fails when fetch fails", async () => {
    const fetchService = getFetchService(() => Promise.reject(new Error("network error")));
    const result = await getLatestGithubReleaseVersion(fetchService, location);
    expect(!result.ok && result.error.message).toContain("network error");
  });

  test("fails when GitHub does not respond with a redirect", async () => {
    const fetchService = getFetchService(() => new Response(null, { status: 404 }));
    const result = await getLatestGithubReleaseVersion(fetchService, location);
    expect(!result.ok && result.error.message).toContain("404");
  });
});

describe("upgradeViaGithubRelease", () => {
  let workDir: string;
  let currentExecutable: string;
  let originalExecPath: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "dcf-upgrade-test-"));
    currentExecutable = join(workDir, "example-cli");
    await writeFile(currentExecutable, "old binary content");
    originalExecPath = process.execPath;
    // upgradeViaGithubRelease reads process.execPath directly (it must always operate on the
    // real running executable in production); override it for the duration of the test so the
    // upgrade's fs operations run against a disposable fixture file instead of the real test
    // runner binary.
    Object.defineProperty(process, "execPath", { value: currentExecutable, configurable: true });
  });

  afterEach(async () => {
    Object.defineProperty(process, "execPath", { value: originalExecPath, configurable: true });
    await rm(workDir, { recursive: true, force: true });
  });

  // Simulates the archive extraction step: `unzip -o <archive> -d <tmpDir>` produces an extracted
  // binary at <tmpDir>/example-cli.
  function simulateUnzip(command: ReadonlyArray<string>): void {
    if (command[0] === "unzip") {
      writeFileSync(join(command[4] as string, "example-cli"), "new binary content");
    }
  }

  function getAssetFetchService(onAssetUrl?: (url: string) => void) {
    return getFetchService((input) => {
      onAssetUrl?.(input.toString());
      return new Response("new binary content", { status: 200 });
    });
  }

  test("on Linux extracts to a staging file and renames it into place, avoiding ETXTBSY", async () => {
    let stagingBinaryChmodPath: string | undefined;
    const { spawnService, calls } = getSpawnService((command) => {
      simulateUnzip(command);
      if (command[0] === "chmod") {
        stagingBinaryChmodPath = command[2];
      }
      return { ok: true, exitCode: 0 };
    });

    await upgradeViaGithubRelease(
      spawnService,
      getAssetFetchService(),
      undefined,
      location,
      "example-cli",
      SupportedOs.LINUX,
      SupportedArch.X64,
    );

    // The final content at currentExecutable must be the new binary - proving a real
    // replacement happened (via rename), not a no-op.
    expect(await readFile(currentExecutable, "utf8")).toEqual("new binary content");
    // chmod +x must run against a staging path in the SAME directory as currentExecutable
    // (same filesystem, required for rename() to be atomic), not os.tmpdir().
    expect(stagingBinaryChmodPath).toBeDefined();
    expect(join(stagingBinaryChmodPath!, "..")).not.toEqual(tmpdir());
    expect(stagingBinaryChmodPath!.startsWith(workDir)).toBe(true);
    expect(calls.filter((c) => c.command[0] === "chmod")).toHaveLength(1);
  });

  const assetLabelCases: Array<[string, SupportedOs, SupportedArch, string]> = [
    ["'aarch64' for macOS arm64", SupportedOs.MACOS, SupportedArch.ARM64, "MacOS_aarch64"],
    ["'x64' for macOS x64 (Intel)", SupportedOs.MACOS, SupportedArch.X64, "MacOS_x64"],
    ["'arm64' for Linux arm64", SupportedOs.LINUX, SupportedArch.ARM64, "Linux_arm64"],
  ];
  for (const [description, os, arch, expectedLabel] of assetLabelCases) {
    test(`requests the ${description} asset label`, async () => {
      let requestedUrl: string | undefined;
      const { spawnService } = getSpawnService((command) => {
        simulateUnzip(command);
        return { ok: true, exitCode: 0 };
      });

      await upgradeViaGithubRelease(
        spawnService,
        getAssetFetchService((url) => {
          requestedUrl = url;
        }),
        undefined,
        location,
        "example-cli",
        os,
        arch,
      );

      expect(requestedUrl).toContain(`example-cli_${expectedLabel}.zip`);
    });
  }

  test("fails when the asset download fails", async () => {
    const { spawnService } = getSpawnService(() => ({ ok: true, exitCode: 0 }));
    await expect(
      upgradeViaGithubRelease(
        spawnService,
        getFetchService(() => new Response(null, { status: 404 })),
        undefined,
        location,
        "example-cli",
        SupportedOs.LINUX,
        SupportedArch.X64,
      ),
    ).rejects.toThrow("HTTP 404");
  });

  test("on Windows deletes any stale '.old.exe' before moving the current exe aside", async () => {
    const oldPath = `${currentExecutable}.old.exe`;
    // Simulate a stale leftover from a previous upgrade run.
    await writeFile(oldPath, "stale leftover from a previous upgrade");
    const { spawnService, calls } = getSpawnService((command) => {
      if (command[0] === "cmd" && command[2] === "del") {
        rmSync(oldPath, { force: true });
      }
      return { ok: true, exitCode: 0 };
    });

    await upgradeViaGithubRelease(
      spawnService,
      getAssetFetchService(),
      undefined,
      location,
      "example-cli",
      SupportedOs.WINDOWS,
      SupportedArch.X64,
    );

    const commands = calls.map((c) => c.command);
    const delIndex = commands.findIndex((c) => c[0] === "cmd" && c[2] === "del");
    const moveIndex = commands.findIndex((c) => c[0] === "cmd" && c[2] === "move");
    expect(delIndex).toBeGreaterThanOrEqual(0);
    expect(moveIndex).toBeGreaterThan(delIndex);
    expect(commands[delIndex]).toEqual(["cmd", "/c", "del", "/f", "/q", oldPath]);
  });
});
