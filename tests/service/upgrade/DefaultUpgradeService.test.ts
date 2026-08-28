import process from "node:process";
import { rmSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { InstallMethod, SupportedArch, SupportedOs } from "@flowscripter/dynamic-cli-framework-api";
import type {
  FetchOptions,
  FetchService,
  SpawnResult,
  SpawnService,
  UpgradeCheckResult,
} from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import DefaultUpgradeService, {
  describeUpgradeCheckResult,
  VERSION_CHECK_TIMEOUT_MS,
} from "../../../src/service/upgrade/DefaultUpgradeService.ts";
import type { UpgradeLocationsConfig } from "../../../src/service/upgrade/UpgradeLocationsConfig.ts";
import { getCLIConfig as getFixtureCLIConfig } from "../../fixtures/CLIConfig.ts";

// The shared fixture uses a non-semver "foobar" version; version comparison tests need a real one.
function getCLIConfig(name?: string): CLIConfig {
  return { ...getFixtureCLIConfig(name), version: "1.0.0" };
}

function getConfig(overrides: Partial<UpgradeLocationsConfig> = {}): UpgradeLocationsConfig {
  return {
    supportedPlatforms: [
      { os: SupportedOs.LINUX, arch: SupportedArch.X64 },
      { os: SupportedOs.LINUX, arch: SupportedArch.ARM64 },
      { os: SupportedOs.MACOS, arch: SupportedArch.ARM64 },
      { os: SupportedOs.WINDOWS, arch: SupportedArch.X64 },
    ],
    ...overrides,
  };
}

function getSpawnService(handler: (command: ReadonlyArray<string>) => SpawnResult): SpawnService {
  return {
    spawn: (command) => Promise.resolve(handler(command)),
  };
}

function getFetchService(
  handler: (input: string | URL, options?: FetchOptions) => Response | Promise<Response>,
): FetchService {
  return {
    fetch: (input, options) => Promise.resolve(handler(input, options)),
  };
}

function githubReleaseRedirect(version: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location: `https://github.com/flowscripter/example-cli/releases/tag/v${version}` },
  });
}

// upgrade() with an override first calls checkForUpgrade() (a redirect response resolving the
// latest version tag), then separately downloads the release asset itself (a 200 with a body).
// Track a URL callback so tests can inspect which asset was requested.
function getGithubReleaseFetchService(
  version: string,
  onAssetUrl?: (url: string) => void,
): FetchService {
  return getFetchService((input) => {
    const url = input.toString();
    if (url.endsWith("/releases/latest")) {
      return githubReleaseRedirect(version);
    }
    onAssetUrl?.(url);
    return new Response("new binary content", { status: 200 });
  });
}

describe("DefaultUpgradeService", () => {
  test("describeUpgradeCheckResult surfaces the error message for a failed check", () => {
    const result: UpgradeCheckResult = { status: "failed", error: new Error("boom") };
    // JSON.stringify(new Error(...)) drops message/stack (non-enumerable own properties) and
    // would otherwise log "error":{} - this is exactly the case the helper exists to fix.
    expect(JSON.stringify(result)).toEqual('{"status":"failed","error":{}}');
    expect(describeUpgradeCheckResult(result)).toEqual("Upgrade check result: failed - boom");
  });

  test("describeUpgradeCheckResult JSON-serializes a non-failed result", () => {
    const result: UpgradeCheckResult = {
      status: "checked",
      currentVersion: "1.0.0",
      latestVersion: "2.0.0",
      updateAvailable: true,
      os: SupportedOs.LINUX,
      arch: SupportedArch.X64,
      installMethod: InstallMethod.GITHUB_RELEASE,
    };
    expect(describeUpgradeCheckResult(result)).toEqual(
      `Upgrade check result: ${JSON.stringify(result)}`,
    );
  });

  test("detectOs maps process.platform to the current OS", () => {
    const service = new DefaultUpgradeService(getConfig(), getCLIConfig());
    const expected =
      process.platform === "linux"
        ? SupportedOs.LINUX
        : process.platform === "darwin"
          ? SupportedOs.MACOS
          : process.platform === "win32"
            ? SupportedOs.WINDOWS
            : undefined;
    expect(service.detectOs()).toEqual(expected);
  });

  test("detectArch maps process.arch to the current arch", () => {
    const service = new DefaultUpgradeService(getConfig(), getCLIConfig());
    const expected =
      process.arch === "x64"
        ? SupportedArch.X64
        : process.arch === "arm64"
          ? SupportedArch.ARM64
          : undefined;
    expect(service.detectArch()).toEqual(expected);
  });

  test("detectInstallMethod falls back to GITHUB_RELEASE when configured and no SpawnService", async () => {
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    expect(await service.detectInstallMethod(SupportedOs.LINUX)).toEqual(
      InstallMethod.GITHUB_RELEASE,
    );
  });

  test("detectInstallMethod returns undefined when nothing configured", async () => {
    const service = new DefaultUpgradeService(getConfig(), getCLIConfig());
    expect(await service.detectInstallMethod(SupportedOs.LINUX)).toBeUndefined();
  });

  test("detectInstallMethod detects HOMEBREW via SpawnService", async () => {
    const service = new DefaultUpgradeService(
      getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
      getCLIConfig(),
    );
    service.setDependencies(
      getSpawnService(() => ({ ok: true, exitCode: 0 })),
      undefined,
    );
    expect(await service.detectInstallMethod(SupportedOs.MACOS)).toEqual(InstallMethod.HOMEBREW);
  });

  test("checkForUpgrade reports unsupported for unsupported platform", async () => {
    const service = new DefaultUpgradeService(
      getConfig({ supportedPlatforms: [] }),
      getCLIConfig(),
    );
    const result = await service.checkForUpgrade(SupportedOs.LINUX, SupportedArch.X64);
    expect(result).toEqual({ status: "unsupported" });
  });

  test("checkForUpgrade reports unsupported when no install method resolved", async () => {
    const service = new DefaultUpgradeService(getConfig(), getCLIConfig());
    const result = await service.checkForUpgrade(SupportedOs.LINUX, SupportedArch.X64);
    expect(result).toEqual({ status: "unsupported" });
  });

  test("checkForUpgrade reports updateAvailable when latest GitHub release is newer", async () => {
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    service.setDependencies(
      undefined,
      getFetchService(() => githubReleaseRedirect("9.9.9")),
    );
    const result = await service.checkForUpgrade(
      SupportedOs.LINUX,
      SupportedArch.X64,
      InstallMethod.GITHUB_RELEASE,
    );
    if (result.status !== "checked") throw new Error(`expected "checked", got ${result.status}`);
    expect(result.updateAvailable).toBe(true);
    expect(result.latestVersion).toEqual("9.9.9");
    expect(result.currentVersion).toEqual(getCLIConfig().version);
  });

  test("checkForUpgrade reports no update available when already latest", async () => {
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    service.setDependencies(
      undefined,
      getFetchService(() => githubReleaseRedirect("0.0.0")),
    );
    const result = await service.checkForUpgrade(
      SupportedOs.LINUX,
      SupportedArch.X64,
      InstallMethod.GITHUB_RELEASE,
    );
    if (result.status !== "checked") throw new Error(`expected "checked", got ${result.status}`);
    expect(result.updateAvailable).toBe(false);
  });

  test("checkForUpgrade does not pass a timeoutMs to the GitHub release lookup", async () => {
    let receivedOptions: FetchOptions | undefined;
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    service.setDependencies(
      undefined,
      getFetchService((_input, options) => {
        receivedOptions = options;
        return githubReleaseRedirect("9.9.9");
      }),
    );
    await service.checkForUpgrade(
      SupportedOs.LINUX,
      SupportedArch.X64,
      InstallMethod.GITHUB_RELEASE,
    );
    expect(receivedOptions?.timeoutMs).toBeUndefined();
  });

  test("checkForUpgrade reports failed when fetch fails", async () => {
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    service.setDependencies(
      undefined,
      getFetchService(() => Promise.reject(new Error("network error"))),
    );
    const result = await service.checkForUpgrade(
      SupportedOs.LINUX,
      SupportedArch.X64,
      InstallMethod.GITHUB_RELEASE,
    );
    expect(result.status).toEqual("failed");
    if (result.status !== "failed") throw new Error("expected failed");
    expect(result.error.message).toContain("network error");
  });

  test("checkForUpgrade reports failed when GitHub does not respond with a redirect", async () => {
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    service.setDependencies(
      undefined,
      getFetchService(() => new Response(null, { status: 404 })),
    );
    const result = await service.checkForUpgrade(
      SupportedOs.LINUX,
      SupportedArch.X64,
      InstallMethod.GITHUB_RELEASE,
    );
    expect(result.status).toEqual("failed");
    if (result.status !== "failed") throw new Error("expected failed");
    expect(result.error.message).toContain("404");
  });

  test("checkForUpgrade resolves latest homebrew version from tap formula file", async () => {
    const service = new DefaultUpgradeService(
      getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
      getCLIConfig(),
    );
    service.setDependencies(
      undefined,
      getFetchService((url) => {
        expect(url).toEqual(
          "https://raw.githubusercontent.com/flowscripter/homebrew-tap/main/example-cli.rb",
        );
        return new Response('version "v9.9.9"', { status: 200 });
      }),
    );
    const result = await service.checkForUpgrade(
      SupportedOs.MACOS,
      SupportedArch.ARM64,
      InstallMethod.HOMEBREW,
    );
    if (result.status !== "checked") throw new Error(`expected "checked", got ${result.status}`);
    expect(result.latestVersion).toEqual("9.9.9");
  });

  test("upgrade returns error when no location configured", async () => {
    const service = new DefaultUpgradeService(getConfig(), getCLIConfig());
    const result = await service.upgrade(SupportedOs.LINUX, SupportedArch.X64);
    expect(result.ok).toBe(false);
    expect(result.oldVersion).toEqual(getCLIConfig().version);
  });

  test("upgrade returns error when SpawnService not available", async () => {
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    service.setDependencies(
      undefined,
      getFetchService(() => githubReleaseRedirect("9.9.9")),
    );
    const result = await service.upgrade(
      SupportedOs.LINUX,
      SupportedArch.X64,
      InstallMethod.GITHUB_RELEASE,
    );
    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain("SpawnService");
  });

  test("upgrade via homebrew invokes 'brew upgrade' and returns new version", async () => {
    const spawnedCommands: ReadonlyArray<string>[] = [];
    const service = new DefaultUpgradeService(
      getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
      getCLIConfig(),
    );
    service.setDependencies(
      getSpawnService((command) => {
        spawnedCommands.push(command);
        return { ok: true, exitCode: 0 };
      }),
      getFetchService(() => new Response('version "v9.9.9"', { status: 200 })),
    );

    const result = await service.upgrade(
      SupportedOs.MACOS,
      SupportedArch.ARM64,
      InstallMethod.HOMEBREW,
    );
    expect(result.ok).toBe(true);
    expect(result.newVersion).toEqual("9.9.9");
    expect(spawnedCommands).toEqual([["brew", "upgrade", "flowscripter/tap/example-cli"]]);
  });

  test("upgrade via homebrew reports failure when brew upgrade fails", async () => {
    const service = new DefaultUpgradeService(
      getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
      getCLIConfig(),
    );
    service.setDependencies(
      getSpawnService(() => ({ ok: false, exitCode: 1 })),
      getFetchService(() => new Response('version "v9.9.9"', { status: 200 })),
    );

    const result = await service.upgrade(
      SupportedOs.MACOS,
      SupportedArch.ARM64,
      InstallMethod.HOMEBREW,
    );
    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain("brew upgrade failed");
  });

  test("getUpgradeCheckResult caches the same promise across calls", async () => {
    let checkCount = 0;
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    service.setDependencies(
      undefined,
      getFetchService(() => {
        checkCount++;
        return githubReleaseRedirect("9.9.9");
      }),
    );

    const first = service.getUpgradeCheckResult(true);
    const second = service.getUpgradeCheckResult(true);
    expect(first).toBe(second);
    await first;
    await second;
    expect(checkCount).toEqual(1);
  });

  test("getUpgradeCheckResult resolves pending if the cached check exceeds VERSION_CHECK_TIMEOUT_MS", async () => {
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    service.setDependencies(
      undefined,
      getFetchService(() => new Promise(() => {})),
    );

    const result = await service.getUpgradeCheckResult();
    expect(result).toEqual({ status: "pending" });
  });

  test("a transient failure on an opportunistic check does not poison a later deliberate wait", async () => {
    let callCount = 0;
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    service.setDependencies(
      undefined,
      getFetchService(() => {
        callCount++;
        // first call (simulating the opportunistic startup check) fails; subsequent calls
        // resolve immediately.
        if (callCount === 1) {
          throw new Error("simulated fetch failure");
        }
        return githubReleaseRedirect("9.9.9");
      }),
    );

    // opportunistic, non-blocking call - its underlying fetch fails immediately.
    const opportunistic = await service.getUpgradeCheckResult();
    expect(opportunistic.status).toEqual("failed");

    // a later, deliberate blocking call (e.g. the `upgrade` command) must get a fresh attempt
    // rather than reusing the earlier failed promise forever.
    const deliberate = await service.getUpgradeCheckResult(true);
    if (deliberate.status !== "checked")
      throw new Error(`expected "checked", got ${deliberate.status}`);
    expect(deliberate.latestVersion).toEqual("9.9.9");
    expect(callCount).toEqual(2);
  });

  test("getUpgradeCheckResult(true) waits for the full result with no timeout", async () => {
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    service.setDependencies(
      undefined,
      getFetchService(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve(githubReleaseRedirect("9.9.9")),
              VERSION_CHECK_TIMEOUT_MS + 50,
            ),
          ),
      ),
    );

    const result = await service.getUpgradeCheckResult(true);
    if (result.status !== "checked") throw new Error(`expected "checked", got ${result.status}`);
    expect(result.latestVersion).toEqual("9.9.9");
  });

  test("upgrade bypasses the cached check when an override is passed", async () => {
    const spawnedCommands: ReadonlyArray<string>[] = [];
    const service = new DefaultUpgradeService(
      getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
      getCLIConfig(),
    );
    service.setDependencies(
      getSpawnService((command) => {
        spawnedCommands.push(command);
        return { ok: true, exitCode: 0 };
      }),
      getFetchService(() => new Response('version "v9.9.9"', { status: 200 })),
    );

    // Prime the cache with default (no-override) detection, which resolves undefined since
    // supportedPlatforms only covers LINUX/MACOS/WINDOWS x specific arches and detectOs()/
    // detectArch() here reflect the actual test host - the override call below must not reuse it.
    void service.getUpgradeCheckResult();

    const result = await service.upgrade(
      SupportedOs.MACOS,
      SupportedArch.ARM64,
      InstallMethod.HOMEBREW,
    );
    expect(result.ok).toBe(true);
    expect(result.newVersion).toEqual("9.9.9");
  });

  describe("upgrade via GitHub release", () => {
    let workDir: string;
    let currentExecutable: string;
    let originalExecPath: string;

    beforeEach(async () => {
      workDir = await mkdtemp(join(tmpdir(), "dcf-upgrade-test-"));
      currentExecutable = join(workDir, "example-cli");
      await writeFile(currentExecutable, "old binary content");
      originalExecPath = process.execPath;
      // #upgradeViaGithubRelease reads process.execPath directly (it must always operate on the
      // real running executable in production); override it for the duration of the test so the
      // fix's fs operations run against a disposable fixture file instead of the real test
      // runner binary.
      Object.defineProperty(process, "execPath", { value: currentExecutable, configurable: true });
    });

    afterEach(async () => {
      Object.defineProperty(process, "execPath", { value: originalExecPath, configurable: true });
      await rm(workDir, { recursive: true, force: true });
    });

    test("upgrade via GitHub release on Linux extracts to a staging file and renames it into place, avoiding ETXTBSY", async () => {
      const spawnedCommands: ReadonlyArray<string>[] = [];
      let stagingBinaryChmodPath: string | undefined;
      const service = new DefaultUpgradeService(
        getConfig({
          githubRelease: {
            owner: "flowscripter",
            repo: "example-cli",
            assetPattern: "example-cli_{os}_{arch}.zip",
          },
        }),
        getCLIConfig("example-cli"),
      );
      service.setDependencies(
        getSpawnService((command) => {
          spawnedCommands.push(command);
          if (command[0] === "unzip") {
            // Simulate the archive extraction step: `unzip -o <archive> -d <tmpDir>` produces
            // an extracted binary at <tmpDir>/example-cli.
            const tmpDir = command[4] as string;
            writeFileSync(join(tmpDir, "example-cli"), "new binary content");
          }
          if (command[0] === "chmod") {
            stagingBinaryChmodPath = command[2];
          }
          return { ok: true, exitCode: 0 };
        }),
        getGithubReleaseFetchService("9.9.9"),
      );

      const result = await service.upgrade(
        SupportedOs.LINUX,
        SupportedArch.X64,
        InstallMethod.GITHUB_RELEASE,
      );

      expect(result.ok).toBe(true);
      // The final content at currentExecutable must be the new binary - proving a real
      // replacement happened (via rename), not a no-op.
      expect(await readFile(currentExecutable, "utf8")).toEqual("new binary content");
      // chmod +x must run against a staging path in the SAME directory as currentExecutable
      // (same filesystem, required for rename() to be atomic), not os.tmpdir().
      expect(stagingBinaryChmodPath).toBeDefined();
      expect(join(stagingBinaryChmodPath!, "..")).not.toEqual(tmpdir());
      expect(stagingBinaryChmodPath!.startsWith(workDir)).toBe(true);
      // No leftover staging directory (created via mkdtemp) should remain.
      const stagingDirEntries = spawnedCommands.filter((c) => c[0] === "chmod").map((c) => c[2]);
      expect(stagingDirEntries.length).toEqual(1);
    });

    test("upgrade via GitHub release requests the 'aarch64' asset label for macOS arm64", async () => {
      let requestedUrl: string | undefined;
      const service = new DefaultUpgradeService(
        getConfig({
          githubRelease: {
            owner: "flowscripter",
            repo: "example-cli",
            assetPattern: "example-cli_{os}_{arch}.zip",
          },
        }),
        getCLIConfig("example-cli"),
      );
      service.setDependencies(
        getSpawnService((command) => {
          if (command[0] === "unzip") {
            const tmpDir = command[4] as string;
            writeFileSync(join(tmpDir, "example-cli"), "new binary content");
          }
          return { ok: true, exitCode: 0 };
        }),
        getGithubReleaseFetchService("9.9.9", (url) => {
          requestedUrl = url;
        }),
      );

      const result = await service.upgrade(
        SupportedOs.MACOS,
        SupportedArch.ARM64,
        InstallMethod.GITHUB_RELEASE,
      );
      expect(result.ok).toBe(true);
      expect(requestedUrl).toContain("example-cli_MacOS_aarch64.zip");
    });

    test("upgrade via GitHub release requests the 'x64' asset label for macOS x64 (Intel)", async () => {
      let requestedUrl: string | undefined;
      const service = new DefaultUpgradeService(
        getConfig({
          supportedPlatforms: [{ os: SupportedOs.MACOS, arch: SupportedArch.X64 }],
          githubRelease: {
            owner: "flowscripter",
            repo: "example-cli",
            assetPattern: "example-cli_{os}_{arch}.zip",
          },
        }),
        getCLIConfig("example-cli"),
      );
      service.setDependencies(
        getSpawnService((command) => {
          if (command[0] === "unzip") {
            const tmpDir = command[4] as string;
            writeFileSync(join(tmpDir, "example-cli"), "new binary content");
          }
          return { ok: true, exitCode: 0 };
        }),
        getGithubReleaseFetchService("9.9.9", (url) => {
          requestedUrl = url;
        }),
      );

      const result = await service.upgrade(
        SupportedOs.MACOS,
        SupportedArch.X64,
        InstallMethod.GITHUB_RELEASE,
      );
      expect(result.ok).toBe(true);
      expect(requestedUrl).toContain("example-cli_MacOS_x64.zip");
    });

    test("upgrade via GitHub release requests the 'arm64' asset label for Linux arm64", async () => {
      let requestedUrl: string | undefined;
      const service = new DefaultUpgradeService(
        getConfig({
          githubRelease: {
            owner: "flowscripter",
            repo: "example-cli",
            assetPattern: "example-cli_{os}_{arch}.zip",
          },
        }),
        getCLIConfig("example-cli"),
      );
      service.setDependencies(
        getSpawnService((command) => {
          if (command[0] === "unzip") {
            const tmpDir = command[4] as string;
            writeFileSync(join(tmpDir, "example-cli"), "new binary content");
          }
          return { ok: true, exitCode: 0 };
        }),
        getGithubReleaseFetchService("9.9.9", (url) => {
          requestedUrl = url;
        }),
      );

      const result = await service.upgrade(
        SupportedOs.LINUX,
        SupportedArch.ARM64,
        InstallMethod.GITHUB_RELEASE,
      );
      expect(result.ok).toBe(true);
      expect(requestedUrl).toContain("example-cli_Linux_arm64.zip");
    });

    test("upgrade via GitHub release on Windows deletes any stale '.old.exe' before moving the current exe aside", async () => {
      const spawnedCommands: ReadonlyArray<string>[] = [];
      const oldPath = `${currentExecutable}.old.exe`;
      // Simulate a stale leftover from a previous upgrade run.
      await writeFile(oldPath, "stale leftover from a previous upgrade");

      const service = new DefaultUpgradeService(
        getConfig({
          githubRelease: {
            owner: "flowscripter",
            repo: "example-cli",
            assetPattern: "example-cli_{os}_{arch}.zip",
          },
        }),
        getCLIConfig("example-cli"),
      );
      service.setDependencies(
        getSpawnService((command) => {
          spawnedCommands.push(command);
          if (command[0] === "cmd" && command[2] === "del") {
            rmSync(oldPath, { force: true });
          }
          return { ok: true, exitCode: 0 };
        }),
        getGithubReleaseFetchService("9.9.9"),
      );

      const result = await service.upgrade(
        SupportedOs.WINDOWS,
        SupportedArch.X64,
        InstallMethod.GITHUB_RELEASE,
      );

      expect(result.ok).toBe(true);
      const delIndex = spawnedCommands.findIndex((c) => c[0] === "cmd" && c[2] === "del");
      const moveIndex = spawnedCommands.findIndex((c) => c[0] === "cmd" && c[2] === "move");
      expect(delIndex).toBeGreaterThanOrEqual(0);
      expect(moveIndex).toBeGreaterThan(delIndex);
      expect(spawnedCommands[delIndex]).toEqual(["cmd", "/c", "del", "/f", "/q", oldPath]);
    });
  });
});
