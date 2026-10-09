import process from "node:process";
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

  test("upgrade dispatches to the linux script, homebrew and winget install methods", async () => {
    const cases: Array<
      [InstallMethod, NodeJS.Platform, Partial<UpgradeLocationsConfig>, string[]]
    > = [
      [
        InstallMethod.LINUX_SCRIPT,
        "linux",
        {
          linuxScript: { scriptUrl: "https://example.com/install.sh" },
          githubRelease: { owner: "flowscripter", repo: "example-cli", assetPattern: "x" },
        },
        ["sh", "-c", "curl -fsSL https://example.com/install.sh | sh"],
      ],
      [
        InstallMethod.HOMEBREW,
        "darwin",
        { homebrew: { tap: "flowscripter/tap", formula: "example-cli" } },
        ["brew", "update"],
      ],
      [
        InstallMethod.WINGET,
        "win32",
        { winget: { packageId: "Flowscripter.ExampleCli" } },
        [
          "winget",
          "upgrade",
          "--id",
          "Flowscripter.ExampleCli",
          "--silent",
          "--accept-package-agreements",
          "--accept-source-agreements",
        ],
      ],
    ];
    for (const [installMethod, platform, config, expectedFirstCommand] of cases) {
      const spawnedCommands: ReadonlyArray<string>[] = [];
      const service = new DefaultUpgradeService(getConfig(config), getCLIConfig());
      setUpgradeServiceDependencies(
        service,
        {
          spawn: (command: ReadonlyArray<string>, options?: SpawnOptions) => {
            if (command[1] === "show" && options?.mode === "wrapped") {
              options.onOutput?.("Version: 9.9.9", "stdout");
            } else {
              spawnedCommands.push(command);
            }
            return Promise.resolve({ ok: true, exitCode: 0 });
          },
        },
        getFetchService((url) =>
          url.toString().endsWith(".rb")
            ? new Response('version "v9.9.9"', { status: 200 })
            : githubReleaseRedirect("9.9.9"),
        ),
        undefined,
      );
      await withHost(platform, platform === "darwin" ? "arm64" : "x64", () =>
        service.upgrade(installMethod),
      );
      expect(spawnedCommands[0]).toEqual(expectedFirstCommand);
    }
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
      {
        spawn: (command: ReadonlyArray<string>, options?: SpawnOptions) => {
          spawnedCommands.push(command);
          if (command[1] === "list" && options?.mode === "wrapped") {
            options.onOutput?.("example-cli 9.9.9", "stdout");
          }
          return Promise.resolve({ ok: true, exitCode: 0 });
        },
      },
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
