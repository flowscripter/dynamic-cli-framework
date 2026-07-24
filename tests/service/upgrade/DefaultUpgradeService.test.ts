import process from "node:process";
import { describe, expect, test } from "bun:test";
import { InstallMethod, SupportedArch, SupportedOs } from "@flowscripter/dynamic-cli-framework-api";
import type {
  FetchOptions,
  FetchService,
  SpawnResult,
  SpawnService,
} from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import DefaultUpgradeService, {
  VERSION_CHECK_TIMEOUT_MS,
} from "../../../src/service/upgrade/DefaultUpgradeService.ts";
import type { UpgradeLocationsConfig } from "../../../src/service/upgrade/UpgradeLocationsConfig.ts";
import { getCLIConfig as getFixtureCLIConfig } from "../../fixtures/CLIConfig.ts";

// The shared fixture uses a non-semver "foobar" version; version comparison tests need a real one.
function getCLIConfig(): CLIConfig {
  return { ...getFixtureCLIConfig(), version: "1.0.0" };
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

describe("DefaultUpgradeService", () => {
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

  test("detectInstallMethod falls through to GITHUB_RELEASE if the winget check times out", async () => {
    const service = new DefaultUpgradeService(
      getConfig({
        winget: { packageId: "Flowscripter.example-cli" },
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    service.setDependencies(
      {
        // Mimics DefaultSpawnService's real timeoutMs handling: a stalled process resolves
        // { ok: false, timedOut: true } once the caller-specified timeoutMs elapses.
        spawn: (_command, options) =>
          options?.timeoutMs === undefined
            ? new Promise(() => {})
            : Promise.resolve({ ok: false, timedOut: true }),
      },
      undefined,
    );
    expect(await service.detectInstallMethod(SupportedOs.WINDOWS)).toEqual(
      InstallMethod.GITHUB_RELEASE,
    );
  });

  test("checkForUpgrade returns undefined for unsupported platform", async () => {
    const service = new DefaultUpgradeService(
      getConfig({ supportedPlatforms: [] }),
      getCLIConfig(),
    );
    const result = await service.checkForUpgrade(SupportedOs.LINUX, SupportedArch.X64);
    expect(result).toBeUndefined();
  });

  test("checkForUpgrade returns undefined when no install method resolved", async () => {
    const service = new DefaultUpgradeService(getConfig(), getCLIConfig());
    const result = await service.checkForUpgrade(SupportedOs.LINUX, SupportedArch.X64);
    expect(result).toBeUndefined();
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
      getFetchService(() => new Response(JSON.stringify({ tag_name: "v9.9.9" }), { status: 200 })),
    );
    const result = await service.checkForUpgrade(
      SupportedOs.LINUX,
      SupportedArch.X64,
      InstallMethod.GITHUB_RELEASE,
    );
    expect(result?.updateAvailable).toBe(true);
    expect(result?.latestVersion).toEqual("9.9.9");
    expect(result?.currentVersion).toEqual(getCLIConfig().version);
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
      getFetchService(() => new Response(JSON.stringify({ tag_name: "v0.0.0" }), { status: 200 })),
    );
    const result = await service.checkForUpgrade(
      SupportedOs.LINUX,
      SupportedArch.X64,
      InstallMethod.GITHUB_RELEASE,
    );
    expect(result?.updateAvailable).toBe(false);
  });

  test("checkForUpgrade passes VERSION_CHECK_TIMEOUT_MS as timeoutMs to the GitHub release lookup", async () => {
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
        return new Response(JSON.stringify({ tag_name: "v9.9.9" }), { status: 200 });
      }),
    );
    await service.checkForUpgrade(
      SupportedOs.LINUX,
      SupportedArch.X64,
      InstallMethod.GITHUB_RELEASE,
    );
    expect(receivedOptions?.timeoutMs).toEqual(VERSION_CHECK_TIMEOUT_MS);
  });

  test("checkForUpgrade returns undefined when fetch fails", async () => {
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
    expect(result).toBeUndefined();
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
    expect(result?.latestVersion).toEqual("9.9.9");
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
      getFetchService(() => new Response(JSON.stringify({ tag_name: "v9.9.9" }), { status: 200 })),
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
        return new Response(JSON.stringify({ tag_name: "v9.9.9" }), { status: 200 });
      }),
    );

    const first = service.getUpgradeCheckResult(true);
    const second = service.getUpgradeCheckResult(true);
    expect(first).toBe(second);
    await first;
    await second;
    expect(checkCount).toEqual(1);
  });

  test("getUpgradeCheckResult resolves undefined if the cached check exceeds VERSION_CHECK_TIMEOUT_MS", async () => {
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
    expect(result).toBeUndefined();
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
              () => resolve(new Response(JSON.stringify({ tag_name: "v9.9.9" }), { status: 200 })),
              VERSION_CHECK_TIMEOUT_MS + 50,
            ),
          ),
      ),
    );

    const result = await service.getUpgradeCheckResult(true);
    expect(result?.latestVersion).toEqual("9.9.9");
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
});
