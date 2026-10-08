import process from "node:process";
import { realpathSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  FETCH_SERVICE_ID,
  InstallMethod,
  KEY_VALUE_SERVICE_ID,
  PRINTER_SERVICE_ID,
  RunState,
  SPAWN_SERVICE_ID,
  SupportedArch,
  SupportedOs,
} from "@flowscripter/dynamic-cli-framework-api";
import type {
  FetchOptions,
  FetchService,
  KeyValueService,
  PrinterService,
  SpawnOptions,
  SpawnResult,
  SpawnService,
  UpgradeCheckResult,
} from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import DefaultUpgradeService, {
  describeUpgradeCheckResult,
  toRunState,
} from "../../../src/service/upgrade/DefaultUpgradeService.ts";
import type { UpgradeLocationsConfig } from "../../../src/service/upgrade/UpgradeLocationsConfig.ts";
import { getCLIConfig as getFixtureCLIConfig } from "../../fixtures/CLIConfig.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";

// The shared fixture uses a non-semver "foobar" version; version comparison tests need a real one.
function getCLIConfig(name?: string): CLIConfig {
  return { ...getFixtureCLIConfig(name), version: "1.0.0" };
}

async function withPlatform(platform: NodeJS.Platform, fn: () => Promise<void>): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
  try {
    await fn();
  } finally {
    Object.defineProperty(process, "platform", original);
  }
}

async function withHost<T>(
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
  fn: () => Promise<T>,
): Promise<T> {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
  const originalArch = Object.getOwnPropertyDescriptor(process, "arch")!;
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
  Object.defineProperty(process, "arch", { value: arch, configurable: true });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, "platform", originalPlatform);
    Object.defineProperty(process, "arch", originalArch);
  }
}

function setUpgradeServiceDependencies(
  service: DefaultUpgradeService,
  spawnService: SpawnService | undefined,
  fetchService: FetchService | undefined,
  printerService: PrinterService | undefined,
  keyValueService?: KeyValueService,
): void {
  const context = new DefaultContext(getCLIConfig());
  if (spawnService) {
    context.addServiceInstance(SPAWN_SERVICE_ID, spawnService);
  }
  if (fetchService) {
    context.addServiceInstance(FETCH_SERVICE_ID, fetchService);
  }
  if (printerService) {
    context.addServiceInstance(PRINTER_SERVICE_ID, printerService);
  }
  if (keyValueService) {
    context.addServiceInstance(KEY_VALUE_SERVICE_ID, keyValueService);
  }
  service.setContext(context);
}

function getConfig(overrides: Partial<UpgradeLocationsConfig> = {}): UpgradeLocationsConfig {
  return {
    supportedPlatforms: [
      { os: SupportedOs.LINUX, arch: SupportedArch.X64 },
      { os: SupportedOs.LINUX, arch: SupportedArch.ARM64 },
      { os: SupportedOs.MACOS, arch: SupportedArch.ARM64 },
      { os: SupportedOs.WINDOWS, arch: SupportedArch.X64 },
      { os: SupportedOs.WINDOWS, arch: SupportedArch.ARM64 },
    ],
    ...overrides,
  };
}

function getSpawnService(handler: (command: ReadonlyArray<string>) => SpawnResult): SpawnService {
  return {
    spawn: (command) => Promise.resolve(handler(command)),
  };
}

function getKeyValueService(): KeyValueService {
  const store = new Map<string, unknown>();
  return {
    get: <T>(key: string) => Promise.resolve(store.get(key) as T),
    set: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    has: (key) => Promise.resolve(store.has(key)),
    delete: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
    flush: () => Promise.resolve(),
  };
}

interface FakePrinterServiceState {
  calls: string[];
  infoMessages: string[];
}

function getFakePrinterService(): {
  printerService: PrinterService;
  state: FakePrinterServiceState;
} {
  const state: FakePrinterServiceState = { calls: [], infoMessages: [] };
  const printerService = {
    startQuote: () => {
      state.calls.push("startQuote");
    },
    endQuote: () => {
      state.calls.push("endQuote");
    },
    startMark: () => {
      state.calls.push("startMark");
    },
    endMark: () => {
      state.calls.push("endMark");
    },
    clearMarked: () => {
      state.calls.push("clearMarked");
      return Promise.resolve();
    },
    discardMark: () => {
      state.calls.push("discardMark");
    },
    info: (message: string) => {
      state.calls.push("info");
      state.infoMessages.push(message);
      return Promise.resolve();
    },
    showSpinner: () => {
      state.calls.push("showSpinner");
      return Promise.resolve();
    },
    hideSpinner: () => {
      state.calls.push("hideSpinner");
      return Promise.resolve();
    },
  } as unknown as PrinterService;
  return { printerService, state };
}

// Unlike getSpawnService(), captures the options passed to spawn() (mode, onOutput) so quote/mark
// wrapping can be verified, and feeds the given output lines through onOutput when present.
function getSpawnServiceWithOutput(
  outputLines: ReadonlyArray<string>,
  result: SpawnResult,
): { spawnService: SpawnService; receivedModes: Array<string | undefined> } {
  const receivedModes: Array<string | undefined> = [];
  const spawnService = {
    spawn: (_command: ReadonlyArray<string>, options?: { mode?: string; onOutput?: unknown }) => {
      receivedModes.push(options?.mode);
      if (typeof options?.onOutput === "function") {
        for (const line of outputLines) {
          (options.onOutput as (line: string, stream: "stdout" | "stderr") => void)(line, "stdout");
        }
      }
      return Promise.resolve(result);
    },
  } as unknown as SpawnService;
  return { spawnService, receivedModes };
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

// upgrade() with an install method override first calls checkForUpgrade() (a redirect response resolving the
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

  test("detectInstallMethod detects HOMEBREW via SpawnService", () =>
    withPlatform("darwin", async () => {
      const service = new DefaultUpgradeService(
        getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
        getCLIConfig(),
      );
      setUpgradeServiceDependencies(
        service,
        getSpawnService(() => ({ ok: true, exitCode: 0 })),
        undefined,
        undefined,
      );
      expect(await service.detectInstallMethod(SupportedOs.MACOS)).toEqual(InstallMethod.HOMEBREW);
    }));

  test("detectInstallMethod detects HOMEBREW from the running executable's Cellar path, without spawning", () =>
    withPlatform("darwin", async () => {
      const originalExecPath = process.execPath;
      process.execPath = "/opt/homebrew/Cellar/example-cli/1.0.0/bin/example-cli";
      try {
        const service = new DefaultUpgradeService(
          getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
          getCLIConfig(),
        );
        // No SpawnService set - a fall-through to `brew list` would throw when detectInstallMethod
        // tries to call spawn() on undefined.
        expect(await service.detectInstallMethod(SupportedOs.MACOS)).toEqual(
          InstallMethod.HOMEBREW,
        );
      } finally {
        process.execPath = originalExecPath;
      }
    }));

  test("detectInstallMethod caches a brew list result so a second call does not spawn again", () =>
    withPlatform("darwin", async () => {
      const originalExecPath = process.execPath;
      process.execPath = "/usr/local/bin/example-cli";
      try {
        let spawnCount = 0;
        const service = new DefaultUpgradeService(
          getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
          getCLIConfig(),
        );
        setUpgradeServiceDependencies(
          service,
          getSpawnService(() => {
            spawnCount += 1;
            return { ok: true, exitCode: 0 };
          }),
          undefined,
          undefined,
          getKeyValueService(),
        );
        expect(await service.detectInstallMethod(SupportedOs.MACOS)).toEqual(
          InstallMethod.HOMEBREW,
        );
        expect(await service.detectInstallMethod(SupportedOs.MACOS)).toEqual(
          InstallMethod.HOMEBREW,
        );
        expect(spawnCount).toEqual(1);
      } finally {
        process.execPath = originalExecPath;
      }
    }));

  test("detectInstallMethod re-detects once a cached install-method entry has expired", () =>
    withPlatform("darwin", async () => {
      const originalExecPath = process.execPath;
      process.execPath = "/usr/local/bin/example-cli";
      try {
        let spawnCount = 0;
        const service = new DefaultUpgradeService(
          getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
          getCLIConfig(),
        );
        const keyValueService = getKeyValueService();
        await keyValueService.set("install-method", {
          method: InstallMethod.HOMEBREW,
          checkedAt: Date.now() - 25 * 60 * 60 * 1000, // 25h ago - past the 24h TTL
        });
        setUpgradeServiceDependencies(
          service,
          getSpawnService(() => {
            spawnCount += 1;
            return { ok: true, exitCode: 0 };
          }),
          undefined,
          undefined,
          keyValueService,
        );
        expect(await service.detectInstallMethod(SupportedOs.MACOS)).toEqual(
          InstallMethod.HOMEBREW,
        );
        expect(spawnCount).toEqual(1);
      } finally {
        process.execPath = originalExecPath;
      }
    }));

  test("detectInstallMethod falls back to detection instead of failing when the KeyValueService throws", () =>
    withPlatform("darwin", async () => {
      const originalExecPath = process.execPath;
      process.execPath = "/usr/local/bin/example-cli";
      try {
        const service = new DefaultUpgradeService(
          getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
          getCLIConfig(),
        );
        const brokenKeyValueService: KeyValueService = {
          get: () => Promise.reject(new Error("Attempt to access undefined key-value data")),
          set: () => Promise.reject(new Error("Attempt to access undefined key-value data")),
          has: () => Promise.reject(new Error("Attempt to access undefined key-value data")),
          delete: () => Promise.reject(new Error("Attempt to access undefined key-value data")),
          flush: () => Promise.reject(new Error("Attempt to access undefined key-value data")),
        };
        setUpgradeServiceDependencies(
          service,
          getSpawnService(() => ({ ok: true, exitCode: 0 })),
          undefined,
          undefined,
          brokenKeyValueService,
        );
        // Simulates a KeyValueService whose scope has already been cleared by the time this
        // detached opportunistic check runs (see UpgradeServiceProvider) - every call throws, but
        // detectInstallMethod() must still resolve rather than propagate.
        expect(await service.detectInstallMethod(SupportedOs.MACOS)).toEqual(
          InstallMethod.HOMEBREW,
        );
      } finally {
        process.execPath = originalExecPath;
      }
    }));

  test("detectInstallMethod does not detect HOMEBREW or WINGET on another platform", () =>
    withPlatform("linux", async () => {
      const service = new DefaultUpgradeService(
        getConfig({
          homebrew: { tap: "flowscripter/tap", formula: "example-cli" },
          winget: { packageId: "flowscripter.example-cli" },
        }),
        getCLIConfig(),
      );
      setUpgradeServiceDependencies(
        service,
        getSpawnService(() => {
          throw new Error("unexpected spawn");
        }),
        undefined,
        undefined,
      );
      expect(await service.detectInstallMethod(SupportedOs.MACOS)).toBeUndefined();
      expect(await service.detectInstallMethod(SupportedOs.WINDOWS)).toBeUndefined();
    }));

  test("detectInstallMethod caches a winget list result so a second call does not spawn again", () =>
    withPlatform("win32", async () => {
      let spawnCount = 0;
      const service = new DefaultUpgradeService(
        getConfig({ winget: { packageId: "flowscripter.example-cli" } }),
        getCLIConfig(),
      );
      setUpgradeServiceDependencies(
        service,
        getSpawnService(() => {
          spawnCount += 1;
          return { ok: true, exitCode: 0 };
        }),
        undefined,
        undefined,
        getKeyValueService(),
      );
      expect(await service.detectInstallMethod(SupportedOs.WINDOWS)).toEqual(InstallMethod.WINGET);
      expect(await service.detectInstallMethod(SupportedOs.WINDOWS)).toEqual(InstallMethod.WINGET);
      expect(spawnCount).toEqual(1);
    }));

  test("checkForUpgrade caches a latest-version lookup within the TTL, refreshing once it expires", async () => {
    let fetchCount = 0;
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    setUpgradeServiceDependencies(
      service,
      undefined,
      getFetchService(() => {
        fetchCount += 1;
        return githubReleaseRedirect(fetchCount === 1 ? "1.1.0" : "1.2.0");
      }),
      undefined,
      getKeyValueService(),
    );

    const first = await withHost("linux", "x64", () =>
      service.checkForUpgrade(InstallMethod.GITHUB_RELEASE),
    );
    if (first.status !== "checked") throw new Error(`expected "checked", got ${first.status}`);
    expect(first.latestVersion).toEqual("1.1.0");

    // Within the TTL - reuses the cached version, no second fetch.
    const second = await withHost("linux", "x64", () =>
      service.checkForUpgrade(InstallMethod.GITHUB_RELEASE),
    );
    if (second.status !== "checked") throw new Error(`expected "checked", got ${second.status}`);
    expect(second.latestVersion).toEqual("1.1.0");
    expect(fetchCount).toEqual(1);
  });

  test("checkForUpgrade refreshes a latest-version lookup once its cache entry has expired", async () => {
    let fetchCount = 0;
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    const keyValueService = getKeyValueService();
    await keyValueService.set("latest-version:github-release", {
      version: "1.0.9",
      checkedAt: Date.now() - 25 * 60 * 60 * 1000, // 25h ago - past the 24h TTL
    });
    setUpgradeServiceDependencies(
      service,
      undefined,
      getFetchService(() => {
        fetchCount += 1;
        return githubReleaseRedirect("2.0.0");
      }),
      undefined,
      keyValueService,
    );

    const result = await withHost("linux", "x64", () =>
      service.checkForUpgrade(InstallMethod.GITHUB_RELEASE),
    );
    if (result.status !== "checked") throw new Error(`expected "checked", got ${result.status}`);
    expect(result.latestVersion).toEqual("2.0.0");
    expect(fetchCount).toEqual(1);
  });

  test("checkForUpgrade falls back to a fresh lookup instead of failing when the KeyValueService throws", async () => {
    let fetchCount = 0;
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    const brokenKeyValueService: KeyValueService = {
      get: () => Promise.reject(new Error("Attempt to access undefined key-value data")),
      set: () => Promise.reject(new Error("Attempt to access undefined key-value data")),
      has: () => Promise.reject(new Error("Attempt to access undefined key-value data")),
      delete: () => Promise.reject(new Error("Attempt to access undefined key-value data")),
      flush: () => Promise.reject(new Error("Attempt to access undefined key-value data")),
    };
    setUpgradeServiceDependencies(
      service,
      undefined,
      getFetchService(() => {
        fetchCount += 1;
        return githubReleaseRedirect("9.9.9");
      }),
      undefined,
      brokenKeyValueService,
    );

    const result = await withHost("linux", "x64", () =>
      service.checkForUpgrade(InstallMethod.GITHUB_RELEASE),
    );
    if (result.status !== "checked") throw new Error(`expected "checked", got ${result.status}`);
    expect(result.latestVersion).toEqual("9.9.9");
    expect(fetchCount).toEqual(1);
  });

  test("checkForUpgrade reports unsupported for unsupported platform", async () => {
    const service = new DefaultUpgradeService(
      getConfig({ supportedPlatforms: [] }),
      getCLIConfig(),
    );
    const result = await withHost("linux", "x64", () => service.checkForUpgrade());
    expect(result).toEqual({ status: "unsupported" });
  });

  test("checkForUpgrade reports unsupported when no install method resolved", async () => {
    const service = new DefaultUpgradeService(getConfig(), getCLIConfig());
    const result = await withHost("linux", "x64", () => service.checkForUpgrade());
    expect(result).toEqual({ status: "unsupported" });
  });

  test("checkForUpgrade reports updateAvailable when latest GitHub release is newer", async () => {
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    setUpgradeServiceDependencies(
      service,
      undefined,
      getFetchService(() => githubReleaseRedirect("9.9.9")),
      undefined,
    );
    const result = await withHost("linux", "x64", () =>
      service.checkForUpgrade(InstallMethod.GITHUB_RELEASE),
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
    setUpgradeServiceDependencies(
      service,
      undefined,
      getFetchService(() => githubReleaseRedirect("0.0.0")),
      undefined,
    );
    const result = await withHost("linux", "x64", () =>
      service.checkForUpgrade(InstallMethod.GITHUB_RELEASE),
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
    setUpgradeServiceDependencies(
      service,
      undefined,
      getFetchService((_input, options) => {
        receivedOptions = options;
        return githubReleaseRedirect("9.9.9");
      }),
      undefined,
    );
    await withHost("linux", "x64", () => service.checkForUpgrade(InstallMethod.GITHUB_RELEASE));
    expect(receivedOptions?.timeoutMs).toBeUndefined();
  });

  test("checkForUpgrade reports failed when fetch fails", async () => {
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    setUpgradeServiceDependencies(
      service,
      undefined,
      getFetchService(() => Promise.reject(new Error("network error"))),
      undefined,
    );
    const result = await withHost("linux", "x64", () =>
      service.checkForUpgrade(InstallMethod.GITHUB_RELEASE),
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
    setUpgradeServiceDependencies(
      service,
      undefined,
      getFetchService(() => new Response(null, { status: 404 })),
      undefined,
    );
    const result = await withHost("linux", "x64", () =>
      service.checkForUpgrade(InstallMethod.GITHUB_RELEASE),
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
    setUpgradeServiceDependencies(
      service,
      undefined,
      getFetchService((url) => {
        expect(url).toEqual(
          "https://raw.githubusercontent.com/flowscripter/homebrew-tap/main/example-cli.rb",
        );
        return new Response('version "v9.9.9"', { status: 200 });
      }),
      undefined,
    );
    const result = await withHost("darwin", "arm64", () =>
      service.checkForUpgrade(InstallMethod.HOMEBREW),
    );
    if (result.status !== "checked") throw new Error(`expected "checked", got ${result.status}`);
    expect(result.latestVersion).toEqual("9.9.9");
  });

  test("upgrade returns error when no location configured", async () => {
    const service = new DefaultUpgradeService(getConfig(), getCLIConfig());
    const result = await withHost("linux", "x64", () => service.upgrade());
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
    setUpgradeServiceDependencies(
      service,
      undefined,
      getFetchService(() => githubReleaseRedirect("9.9.9")),
      undefined,
    );
    const result = await withHost("linux", "x64", () =>
      service.upgrade(InstallMethod.GITHUB_RELEASE),
    );
    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain("SpawnService");
  });

  const brewConfig = () =>
    getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } });

  function getBrewSpawnService(
    spawnedCommands: ReadonlyArray<string>[],
    handler: (command: ReadonlyArray<string>) => SpawnResult,
    listOutput: string,
  ): SpawnService {
    return {
      spawn: (command: ReadonlyArray<string>, options?: { onOutput?: unknown }) => {
        spawnedCommands.push(command);
        if (command[1] === "list" && typeof options?.onOutput === "function") {
          (options.onOutput as (line: string, stream: "stdout" | "stderr") => void)(
            listOutput,
            "stdout",
          );
        }
        return Promise.resolve(handler(command));
      },
    } as unknown as SpawnService;
  }

  test("upgrade via homebrew updates, upgrades and verifies the installed version", async () => {
    const spawnedCommands: ReadonlyArray<string>[] = [];
    const service = new DefaultUpgradeService(brewConfig(), getCLIConfig());
    setUpgradeServiceDependencies(
      service,
      getBrewSpawnService(spawnedCommands, () => ({ ok: true, exitCode: 0 }), "example-cli 9.9.9"),
      getFetchService(() => new Response('version "v9.9.9"', { status: 200 })),
      undefined,
    );

    const result = await withHost("darwin", "arm64", () => service.upgrade(InstallMethod.HOMEBREW));
    expect(result.ok).toBe(true);
    expect(result.newVersion).toEqual("9.9.9");
    expect(spawnedCommands).toEqual([
      ["brew", "update"],
      ["brew", "upgrade", "flowscripter/tap/example-cli"],
      ["brew", "list", "--versions", "example-cli"],
    ]);
  });

  test("upgrade via homebrew reports failure when brew update fails", async () => {
    const spawnedCommands: ReadonlyArray<string>[] = [];
    const service = new DefaultUpgradeService(brewConfig(), getCLIConfig());
    setUpgradeServiceDependencies(
      service,
      getBrewSpawnService(spawnedCommands, () => ({ ok: false, exitCode: 1 }), ""),
      getFetchService(() => new Response('version "v9.9.9"', { status: 200 })),
      undefined,
    );

    const result = await withHost("darwin", "arm64", () => service.upgrade(InstallMethod.HOMEBREW));
    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain("brew update failed");
    expect(spawnedCommands).toEqual([["brew", "update"]]);
  });

  test("upgrade via homebrew reports failure when brew upgrade fails", async () => {
    const service = new DefaultUpgradeService(brewConfig(), getCLIConfig());
    setUpgradeServiceDependencies(
      service,
      getBrewSpawnService([], (command) => ({ ok: command[1] === "update", exitCode: 1 }), ""),
      getFetchService(() => new Response('version "v9.9.9"', { status: 200 })),
      undefined,
    );

    const result = await withHost("darwin", "arm64", () => service.upgrade(InstallMethod.HOMEBREW));
    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain("brew upgrade failed");
  });

  test("upgrade via homebrew reports failure when the expected version is not installed", async () => {
    const service = new DefaultUpgradeService(brewConfig(), getCLIConfig());
    setUpgradeServiceDependencies(
      service,
      getBrewSpawnService([], () => ({ ok: true, exitCode: 0 }), "example-cli 3.0.8"),
      getFetchService(() => new Response('version "v9.9.9"', { status: 200 })),
      undefined,
    );

    const result = await withHost("darwin", "arm64", () => service.upgrade(InstallMethod.HOMEBREW));
    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain(
      "9.9.9 is not installed (installed: example-cli 3.0.8)",
    );
  });

  test("upgrade wraps the spawned install output in quote/mark and clears it on success", async () => {
    const { spawnService, receivedModes } = getSpawnServiceWithOutput(
      ["==> Upgrading example-cli", "example-cli 9.9.9"],
      { ok: true, exitCode: 0 },
    );
    const { printerService, state } = getFakePrinterService();
    const service = new DefaultUpgradeService(
      getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
      getCLIConfig(),
    );
    setUpgradeServiceDependencies(
      service,
      spawnService,
      getFetchService(() => new Response('version "v9.9.9"', { status: 200 })),
      printerService,
    );

    const result = await withHost("darwin", "arm64", () => service.upgrade(InstallMethod.HOMEBREW));

    expect(result.ok).toBe(true);
    expect(receivedModes).toEqual(["wrapped", "wrapped", "wrapped"]);
    expect(state.calls).toEqual([
      "showSpinner", // "Installing version 9.9.9..."
      "hideSpinner",
      "startQuote",
      "startMark",
      "info",
      "info",
      "endQuote",
      "endMark",
      "clearMarked",
      "startQuote",
      "startMark",
      "info",
      "info",
      "endQuote",
      "endMark",
      "clearMarked",
    ]);
    expect(state.infoMessages).toContain("==> Upgrading example-cli\n");
  });

  test("upgrade leaves the spawned install output visible when it fails", async () => {
    const { spawnService } = getSpawnServiceWithOutput(["Error: formula not found"], {
      ok: false,
      exitCode: 1,
    });
    const { printerService, state } = getFakePrinterService();
    const service = new DefaultUpgradeService(
      getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
      getCLIConfig(),
    );
    setUpgradeServiceDependencies(
      service,
      spawnService,
      getFetchService(() => new Response('version "v9.9.9"', { status: 200 })),
      printerService,
    );

    const result = await withHost("darwin", "arm64", () => service.upgrade(InstallMethod.HOMEBREW));

    expect(result.ok).toBe(false);
    expect(state.calls).toContain("discardMark");
    expect(state.calls).not.toContain("clearMarked");
  });

  test("getUpgradeCheckResult caches the same promise across calls", async () => {
    let checkCount = 0;
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    setUpgradeServiceDependencies(
      service,
      undefined,
      getFetchService(() => {
        checkCount++;
        return githubReleaseRedirect("9.9.9");
      }),
      undefined,
    );

    const first = service.getUpgradeCheckResult();
    const second = service.getUpgradeCheckResult();
    expect(first).toBe(second);
    await first;
    await second;
    expect(checkCount).toEqual(1);
  });

  test("a transient failure on an opportunistic check does not poison a later deliberate wait", async () => {
    let callCount = 0;
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    setUpgradeServiceDependencies(
      service,
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
      undefined,
    );

    // opportunistic, non-blocking call - its underlying fetch fails immediately.
    const opportunistic = await service.getUpgradeCheckResult();
    expect(opportunistic.status).toEqual("failed");

    // a later, deliberate blocking call (e.g. the `upgrade` command) must get a fresh attempt
    // rather than reusing the earlier failed promise forever.
    const deliberate = await service.getUpgradeCheckResult();
    if (deliberate.status !== "checked")
      throw new Error(`expected "checked", got ${deliberate.status}`);
    expect(deliberate.latestVersion).toEqual("9.9.9");
    expect(callCount).toEqual(2);
  });

  test("getUpgradeCheckResult waits for the full result with no timeout", async () => {
    const service = new DefaultUpgradeService(
      getConfig({
        githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
      }),
      getCLIConfig(),
    );
    setUpgradeServiceDependencies(
      service,
      undefined,
      getFetchService(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(githubReleaseRedirect("9.9.9")), 50)),
      ),
      undefined,
    );

    const result = await service.getUpgradeCheckResult();
    if (result.status !== "checked") throw new Error(`expected "checked", got ${result.status}`);
    expect(result.latestVersion).toEqual("9.9.9");
  });

  test("upgrade bypasses the cached check when an install method override is passed", async () => {
    const spawnedCommands: ReadonlyArray<string>[] = [];
    const service = new DefaultUpgradeService(
      getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
      getCLIConfig(),
    );
    setUpgradeServiceDependencies(
      service,
      getBrewSpawnService(spawnedCommands, () => ({ ok: true, exitCode: 0 }), "example-cli 9.9.9"),
      getFetchService(() => new Response('version "v9.9.9"', { status: 200 })),
      undefined,
    );

    // Prime the cache with default detection, which resolves no install method since none is
    // detected for this config - the override call below must not reuse it.
    void service.getUpgradeCheckResult();

    const result = await withHost("darwin", "arm64", () => service.upgrade(InstallMethod.HOMEBREW));
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
      // upgrade's fs operations run against a disposable fixture file instead of the real test
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
      setUpgradeServiceDependencies(
        service,
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
        undefined,
      );

      const result = await withHost("linux", "x64", () =>
        service.upgrade(InstallMethod.GITHUB_RELEASE),
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
      setUpgradeServiceDependencies(
        service,
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
        undefined,
      );

      const result = await withHost("darwin", "arm64", () =>
        service.upgrade(InstallMethod.GITHUB_RELEASE),
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
      setUpgradeServiceDependencies(
        service,
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
        undefined,
      );

      const result = await withHost("darwin", "x64", () =>
        service.upgrade(InstallMethod.GITHUB_RELEASE),
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
      setUpgradeServiceDependencies(
        service,
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
        undefined,
      );

      const result = await withHost("linux", "arm64", () =>
        service.upgrade(InstallMethod.GITHUB_RELEASE),
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
      setUpgradeServiceDependencies(
        service,
        getSpawnService((command) => {
          spawnedCommands.push(command);
          if (command[0] === "cmd" && command[2] === "del") {
            rmSync(oldPath, { force: true });
          }
          return { ok: true, exitCode: 0 };
        }),
        getGithubReleaseFetchService("9.9.9"),
        undefined,
      );

      const result = await withHost("win32", "x64", () =>
        service.upgrade(InstallMethod.GITHUB_RELEASE),
      );

      expect(result.ok).toBe(true);
      const delIndex = spawnedCommands.findIndex((c) => c[0] === "cmd" && c[2] === "del");
      const moveIndex = spawnedCommands.findIndex((c) => c[0] === "cmd" && c[2] === "move");
      expect(delIndex).toBeGreaterThanOrEqual(0);
      expect(moveIndex).toBeGreaterThan(delIndex);
      expect(spawnedCommands[delIndex]).toEqual(["cmd", "/c", "del", "/f", "/q", oldPath]);
    });
  });

  describe("restart after an automatic upgrade", () => {
    const REEXEC_ENV_VAR = "DYNAMIC_CLI_FRAMEWORK_REEXEC_FROM";
    let originalExecPath: string;
    let originalReexecFrom: string | undefined;

    beforeEach(() => {
      originalExecPath = process.execPath;
      originalReexecFrom = process.env[REEXEC_ENV_VAR];
    });

    afterEach(() => {
      process.execPath = originalExecPath;
      if (originalReexecFrom === undefined) {
        delete process.env[REEXEC_ENV_VAR];
      } else {
        process.env[REEXEC_ENV_VAR] = originalReexecFrom;
      }
    });

    test("restartedFromVersion is read from the environment", () => {
      delete process.env[REEXEC_ENV_VAR];
      expect(new DefaultUpgradeService(getConfig(), getCLIConfig()).restartedFromVersion).toBe(
        undefined,
      );

      process.env[REEXEC_ENV_VAR] = "0.9.0";
      expect(new DefaultUpgradeService(getConfig(), getCLIConfig()).restartedFromVersion).toEqual(
        "0.9.0",
      );
    });

    test("resolveUpgradedExecutable returns the running executable for GitHub release and Linux script installs", () => {
      process.execPath = "/usr/local/bin/example-cli";
      const service = new DefaultUpgradeService(getConfig(), getCLIConfig());

      expect(service.resolveUpgradedExecutable(InstallMethod.GITHUB_RELEASE)).toEqual(
        "/usr/local/bin/example-cli",
      );
      expect(service.resolveUpgradedExecutable(InstallMethod.LINUX_SCRIPT)).toEqual(
        "/usr/local/bin/example-cli",
      );
    });

    test("resolveUpgradedExecutable returns undefined for winget installs", () => {
      const service = new DefaultUpgradeService(
        getConfig({ winget: { packageId: "flowscripter.example-cli" } }),
        getCLIConfig(),
      );

      expect(service.resolveUpgradedExecutable(InstallMethod.WINGET)).toBeUndefined();
    });

    // Homebrew paths are POSIX paths
    test.skipIf(process.platform === "win32")(
      "resolveUpgradedExecutable returns the homebrew opt executable when it exists",
      async () => {
        const prefix = await mkdtemp(join(tmpdir(), "homebrew-"));
        try {
          const cellarBin = join(prefix, "Cellar", "example-cli", "1.0.0", "bin");
          const optBin = join(prefix, "opt", "example-cli", "bin");
          await mkdir(cellarBin, { recursive: true });
          await writeFile(join(cellarBin, "example-cli"), "");
          process.execPath = join(cellarBin, "example-cli");
          const service = new DefaultUpgradeService(
            getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
            getCLIConfig(),
          );

          expect(service.resolveUpgradedExecutable(InstallMethod.HOMEBREW)).toBeUndefined();

          await mkdir(optBin, { recursive: true });
          await writeFile(join(optBin, "example-cli"), "");

          // the temporary directory may itself be behind a symlink (e.g. /var on macOS)
          expect(service.resolveUpgradedExecutable(InstallMethod.HOMEBREW)).toEqual(
            join(realpathSync(prefix), "opt", "example-cli", "bin", "example-cli"),
          );
        } finally {
          await rm(prefix, { recursive: true, force: true });
        }
      },
    );

    test("resolveUpgradedExecutable returns undefined for homebrew when not running from the Cellar", () => {
      process.execPath = "/usr/local/bin/example-cli";
      const service = new DefaultUpgradeService(
        getConfig({ homebrew: { tap: "flowscripter/tap", formula: "example-cli" } }),
        getCLIConfig(),
      );

      expect(service.resolveUpgradedExecutable(InstallMethod.HOMEBREW)).toBeUndefined();
    });

    test("restart spawns the executable with the args, inherited output, long-running mode and the restarted-from version", async () => {
      const calls: Array<{ command: ReadonlyArray<string>; options?: SpawnOptions }> = [];
      const service = new DefaultUpgradeService(getConfig(), getCLIConfig());
      setUpgradeServiceDependencies(
        service,
        {
          spawn: (command, options) => {
            calls.push({ command, options });
            return Promise.resolve({ ok: false, exitCode: 2 });
          },
        },
        undefined,
        undefined,
      );

      const runState = await service.restart("/opt/bin/example-cli", ["foo", "--bar"]);

      expect(runState).toEqual(RunState.NO_COMMAND);
      expect(calls).toEqual([
        {
          command: ["/opt/bin/example-cli", "foo", "--bar"],
          options: {
            mode: "inherit",
            longRunning: true,
            env: { [REEXEC_ENV_VAR]: "1.0.0" },
          },
        },
      ]);
    });

    test("restart returns undefined when the executable cannot be started", async () => {
      const service = new DefaultUpgradeService(getConfig(), getCLIConfig());
      setUpgradeServiceDependencies(
        service,
        getSpawnService(() => ({ ok: false, error: new Error("ENOENT") })),
        undefined,
        undefined,
      );

      expect(await service.restart("/missing", [])).toBeUndefined();
    });

    test("toRunState maps the child's result to a RunState", () => {
      expect(toRunState({ ok: true, exitCode: 0 })).toEqual(RunState.SUCCESS);
      for (const runState of [
        RunState.PARSE_ERROR,
        RunState.NO_COMMAND,
        RunState.EXECUTION_ERROR,
        RunState.RUNTIME_ERROR,
        RunState.INTERRUPTED,
        RunState.TERMINATED,
      ]) {
        expect(toRunState({ ok: false, exitCode: runState })).toEqual(runState);
      }
      // SIGINT, SIGTERM and SIGKILL are reported as 128 + the signal number
      expect(toRunState({ ok: false, exitCode: 128 + 2 })).toEqual(RunState.INTERRUPTED);
      expect(toRunState({ ok: false, exitCode: 128 + 15 })).toEqual(RunState.TERMINATED);
      expect(toRunState({ ok: false, exitCode: 128 + 9 })).toEqual(RunState.TERMINATED);
      expect(toRunState({ ok: false, timedOut: true })).toEqual(RunState.TERMINATED);
      expect(toRunState({ ok: false, exitCode: 5 })).toEqual(RunState.RUNTIME_ERROR);
      expect(toRunState({ ok: false, exitCode: 127 })).toEqual(RunState.RUNTIME_ERROR);
      expect(toRunState({ ok: false, error: new Error("ENOENT") })).toBeUndefined();
    });
  });
});
