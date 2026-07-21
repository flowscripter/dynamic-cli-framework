import process from "node:process";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { InstallMethod, SupportedArch, SupportedOs } from "@flowscripter/dynamic-cli-framework-api";
import type { SpawnResult, SpawnService } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import DefaultUpgradeService from "../../../src/service/upgrade/DefaultUpgradeService.ts";
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

describe("DefaultUpgradeService", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
    service.setDependencies(getSpawnService(() => ({ ok: true, exitCode: 0 })));
    expect(await service.detectInstallMethod(SupportedOs.MACOS)).toEqual(InstallMethod.HOMEBREW);
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
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ tag_name: "v9.9.9" }), { status: 200 }),
      )) as unknown as typeof fetch;

    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
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
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ tag_name: "v0.0.0" }), { status: 200 }),
      )) as unknown as typeof fetch;

    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    const result = await service.checkForUpgrade(
      SupportedOs.LINUX,
      SupportedArch.X64,
      InstallMethod.GITHUB_RELEASE,
    );
    expect(result?.updateAvailable).toBe(false);
  });

  test("checkForUpgrade aborts the GitHub release lookup if it stalls past the timeout", async () => {
    globalThis.fetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason as Error));
      })) as unknown as typeof fetch;

    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    const result = await service.checkForUpgrade(
      SupportedOs.LINUX,
      SupportedArch.X64,
      InstallMethod.GITHUB_RELEASE,
    );
    expect(result).toBeUndefined();
  }, 10000);

  test("checkForUpgrade returns undefined when fetch fails", async () => {
    globalThis.fetch = (() =>
      Promise.reject(new Error("network error"))) as unknown as typeof fetch;

    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    const result = await service.checkForUpgrade(
      SupportedOs.LINUX,
      SupportedArch.X64,
      InstallMethod.GITHUB_RELEASE,
    );
    expect(result).toBeUndefined();
  });

  test("checkForUpgrade resolves latest homebrew version from tap formula file", async () => {
    globalThis.fetch = ((url: string) => {
      expect(url).toEqual(
        "https://raw.githubusercontent.com/flowscripter/homebrew-tap/main/example-cli.rb",
      );
      return Promise.resolve(new Response('version "v9.9.9"', { status: 200 }));
    }) as unknown as typeof fetch;

    const service = new DefaultUpgradeService(
      getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
      getCLIConfig(),
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
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ tag_name: "v9.9.9" }), { status: 200 }),
      )) as unknown as typeof fetch;

    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
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
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response('version "v9.9.9"', { status: 200 }),
      )) as unknown as typeof fetch;

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
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response('version "v9.9.9"', { status: 200 }),
      )) as unknown as typeof fetch;

    const service = new DefaultUpgradeService(
      getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
      getCLIConfig(),
    );
    service.setDependencies(getSpawnService(() => ({ ok: false, exitCode: 1 })));

    const result = await service.upgrade(
      SupportedOs.MACOS,
      SupportedArch.ARM64,
      InstallMethod.HOMEBREW,
    );
    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain("brew upgrade failed");
  });
});
