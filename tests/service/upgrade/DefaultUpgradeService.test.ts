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

function githubReleaseRedirect(version: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location: `https://github.com/flowscripter/example-cli/releases/tag/v${version}` },
  });
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
});
