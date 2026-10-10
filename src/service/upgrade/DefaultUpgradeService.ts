import process from "node:process";
import type {
  CLIConfig,
  Context,
  FetchService,
  KeyValueService,
  PrinterService,
  SettableValueNode,
  SpawnResult,
  SpawnService,
  UpgradeCheckResult,
  UpgradeResult,
  ValueNode,
} from "@flowscripter/dynamic-cli-framework-api";
import {
  FETCH_SERVICE_ID,
  InstallMethod,
  KEY_VALUE_SERVICE_ID,
  PRINTER_SERVICE_ID,
  RunState,
  SPAWN_SERVICE_ID,
  SupportedArch,
  SupportedOs,
  type UpgradeService,
} from "@flowscripter/dynamic-cli-framework-api";
import semver from "semver";
import type { UpgradeLocationsConfig } from "./UpgradeLocationsConfig.ts";
import { getLatestGithubReleaseVersion, upgradeViaGithubRelease } from "./method/githubRelease.ts";
import {
  getLatestHomebrewVersion,
  isHomebrewInstalled,
  isRunningFromHomebrewCellar,
  resolveHomebrewOptExecutable,
  upgradeViaHomebrew,
} from "./method/homebrew.ts";
import { isLinuxScriptInstall, upgradeViaLinuxScript } from "./method/linuxScript.ts";
import type { VersionLookupResult } from "./method/shared.ts";
import { getLatestWingetVersion, isWingetInstalled, upgradeViaWinget } from "./method/winget.ts";
import getLogger from "../../util/logger.ts";

const logger = getLogger("DefaultUpgradeService");

// KeyValueService key caching the resolved InstallMethod (see detectInstallMethod()). Stored
// value shape: { method: InstallMethod, checkedAt: number } where checkedAt is Date.now() at
// detection time - refreshed on the same CACHE_TTL_MILLIS cycle as the latest-version cache below,
// rather than trusted indefinitely, so a reinstall via a different method is eventually picked up
// even outside the no-spawn signals (Cellar path, linux script prefix) that self-heal immediately.
const INSTALL_METHOD_CACHE_KEY = "install-method";

// KeyValueService key prefix caching a #getLatestVersion() lookup per install method, e.g.
// "latest-version:homebrew". Stored value shape: { version: string, checkedAt: number } where
// checkedAt is Date.now() at lookup time - see CACHE_TTL_MILLIS.
const LATEST_VERSION_CACHE_KEY_PREFIX = "latest-version:";

// How long a cached install-method or latest-version lookup is trusted before a fresh
// spawn/network lookup runs again - long enough to remove the cost from routine invocations,
// short enough that a genuine reinstall or new release surfaces within about a day.
const CACHE_TTL_MILLIS = 24 * 60 * 60 * 1000;

interface CachedInstallMethod {
  method: InstallMethod;
  checkedAt: number;
  [key: string]: ValueNode;
}

interface CachedLatestVersion {
  version: string;
  checkedAt: number;
  [key: string]: ValueNode;
}

// KeyValueService key holding the last checkForUpgrade() result, refreshed opportunistically by
// UpgradeServiceProvider's background StartupTask and by the `upgrade` command - shared by both so
// there's one cache, not two. The key lives in this service's own KeyValueService scope, so other
// consumers (e.g. the banner task) read it via getCachedUpgradeCheckResult() rather than their own
// scoped KeyValueService. The banner never calls checkForUpgrade()/getUpgradeCheckResult() live,
// since checking live would stall startup on the network/spawn calls checkForUpgrade() makes.
export const UPGRADE_CHECK_CACHE_KEY = "upgrade-check-result";

export function describeUpgradeCheckResult(result: UpgradeCheckResult): string {
  return result.status === "failed"
    ? `Upgrade check result: failed - ${result.error.message}`
    : `Upgrade check result: ${JSON.stringify(result)}`;
}

// Environment variable set on a process restarted after an automatic upgrade, holding the version
// which restarted it (see DefaultUpgradeService.restart() and restartedFromVersion).
const RESTARTED_FROM_VERSION_ENV_VAR = "DYNAMIC_CLI_FRAMEWORK_REEXEC_FROM";

// Exit codes from 129 upwards are reported for a child terminated by a signal (128 + signal number).
const SIGNAL_EXIT_CODE_BASE = 128;

const RUN_STATE_VALUES = new Set<number>(
  Object.values(RunState).filter((value): value is number => typeof value === "number"),
);

/**
 * Map the result of spawning a restarted CLI to the {@link RunState} it ended with.
 *
 * The child is the same framework CLI, so it normally exits with a {@link RunState} value, which is
 * returned as is (this includes 130 for SIGINT and 143 for SIGTERM). Termination by any other
 * signal, or a timeout, maps to {@link RunState.TERMINATED}, and any other exit code to
 * {@link RunState.RUNTIME_ERROR}.
 *
 * @return the {@link RunState}, or `undefined` if the child could not be started.
 */
export function toRunState(result: SpawnResult): RunState | undefined {
  if (result.ok) {
    return RunState.SUCCESS;
  }
  if ("timedOut" in result) {
    return RunState.TERMINATED;
  }
  if (result.exitCode === undefined) {
    return undefined;
  }
  if (RUN_STATE_VALUES.has(result.exitCode)) {
    return result.exitCode as RunState;
  }
  if (result.exitCode > SIGNAL_EXIT_CODE_BASE) {
    return RunState.TERMINATED;
  }
  return RunState.RUNTIME_ERROR;
}

export default class DefaultUpgradeService implements UpgradeService {
  #context: Context | undefined;
  #upgradeCheckPromise: Promise<UpgradeCheckResult> | undefined;
  readonly #config: UpgradeLocationsConfig;
  readonly #cliConfig: CLIConfig;
  public readonly restartedFromVersion: string | undefined;

  public constructor(config: UpgradeLocationsConfig, cliConfig: CLIConfig) {
    this.#config = config;
    this.#cliConfig = cliConfig;
    this.restartedFromVersion = process.env[RESTARTED_FROM_VERSION_ENV_VAR] || undefined;
  }

  public setContext(context: Context): void {
    this.#context = context;
  }

  get #spawnService(): SpawnService | undefined {
    return this.#context?.doesServiceExist(SPAWN_SERVICE_ID)
      ? (this.#context.getServiceById(SPAWN_SERVICE_ID) as SpawnService)
      : undefined;
  }

  get #fetchService(): FetchService | undefined {
    return this.#context?.doesServiceExist(FETCH_SERVICE_ID)
      ? (this.#context.getServiceById(FETCH_SERVICE_ID) as FetchService)
      : undefined;
  }

  get #printerService(): PrinterService | undefined {
    return this.#context?.doesServiceExist(PRINTER_SERVICE_ID)
      ? (this.#context.getServiceById(PRINTER_SERVICE_ID) as PrinterService)
      : undefined;
  }

  get #keyValueService(): KeyValueService | undefined {
    return this.#context?.doesServiceExist(KEY_VALUE_SERVICE_ID)
      ? (this.#context.getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService)
      : undefined;
  }

  public getUpgradeCheckResult(): Promise<UpgradeCheckResult> {
    if (!this.#upgradeCheckPromise) {
      logger.debug(() => "Starting upgrade check");
      // Only cache a non-"failed" result. A "failed" result can come from a transient issue
      // (e.g. a network blip) - caching that would permanently deny a later caller any chance of
      // a fresh attempt for the rest of this process's lifetime.
      this.#upgradeCheckPromise = this.checkForUpgrade().then((result) => {
        logger.debug(() => describeUpgradeCheckResult(result));
        if (result.status === "failed") {
          this.#upgradeCheckPromise = undefined;
        }
        return result;
      });
    }
    return this.#upgradeCheckPromise;
  }

  /**
   * Run (or reuse an in-flight/cached) {@link getUpgradeCheckResult}, then persist a "checked" or
   * "unsupported" result to {@link UPGRADE_CHECK_CACHE_KEY} so the banner task's cheap KV read can
   * pick it up on a later invocation.
   */
  public async refreshUpgradeCheckCache(): Promise<UpgradeCheckResult> {
    const result = await this.getUpgradeCheckResult();
    if (this.#keyValueService && (result.status === "checked" || result.status === "unsupported")) {
      const keyValueService = this.#keyValueService;
      await this.#safeKeyValueCall(() =>
        keyValueService.set(UPGRADE_CHECK_CACHE_KEY, result as unknown as SettableValueNode),
      );
    }
    return result;
  }

  /**
   * Return the result last persisted by {@link refreshUpgradeCheckCache}, without running a check.
   * Returns `undefined` if nothing has been persisted yet or no KeyValueService is available.
   */
  public async getCachedUpgradeCheckResult(): Promise<UpgradeCheckResult | undefined> {
    const keyValueService = this.#keyValueService;
    if (!keyValueService) {
      return undefined;
    }
    const has = await this.#safeKeyValueCall(() => keyValueService.has(UPGRADE_CHECK_CACHE_KEY));
    if (!has) {
      return undefined;
    }
    const cached = await this.#safeKeyValueCall(() => keyValueService.get(UPGRADE_CHECK_CACHE_KEY));
    return cached as unknown as UpgradeCheckResult | undefined;
  }

  /**
   * Resolve the executable to restart into after a successful upgrade via `installMethod`.
   *
   * @return the executable path, or `undefined` if it cannot be resolved (e.g. for winget, or a
   * homebrew install whose `opt` link is missing).
   */
  public resolveUpgradedExecutable(installMethod: InstallMethod): string | undefined {
    switch (installMethod) {
      case InstallMethod.GITHUB_RELEASE:
      case InstallMethod.LINUX_SCRIPT:
        return process.execPath;
      case InstallMethod.HOMEBREW:
        return resolveHomebrewOptExecutable(this.#config.homebrew);
      case InstallMethod.WINGET:
        return undefined;
    }
  }

  /**
   * Run `executable` with `args` in place of this process, with terminal input and output
   * inherited, and wait for it to exit. The child process sees the current version as its
   * {@link restartedFromVersion}.
   *
   * @return the {@link RunState} the child ended with (see {@link toRunState}), or `undefined` if
   * it could not be started.
   */
  public async restart(
    executable: string,
    args: ReadonlyArray<string>,
  ): Promise<RunState | undefined> {
    const spawnService = this.#spawnService;
    if (!spawnService) {
      return undefined;
    }
    const result = await spawnService.spawn([executable, ...args], {
      mode: "inherit",
      // Ctrl-C reaches the child directly from the terminal, so this process only notes it
      longRunning: true,
      env: { [RESTARTED_FROM_VERSION_ENV_VAR]: this.#cliConfig.version },
    });
    return toRunState(result);
  }

  public detectOs(): SupportedOs | undefined {
    if (process.platform === "linux") {
      return SupportedOs.LINUX;
    }
    if (process.platform === "darwin") {
      return SupportedOs.MACOS;
    }
    if (process.platform === "win32") {
      return SupportedOs.WINDOWS;
    }
    return undefined;
  }

  public detectArch(): SupportedArch | undefined {
    if (process.arch === "x64") {
      return SupportedArch.X64;
    }
    if (process.arch === "arm64") {
      return SupportedArch.ARM64;
    }
    return undefined;
  }

  public async detectInstallMethod(os: SupportedOs): Promise<InstallMethod | undefined> {
    // Cheap, no-spawn signals are checked first and always win over the cache below, so a fresh
    // install is picked up immediately rather than waiting on a stale cached method.
    // Each platform-specific branch also compares process.platform directly, so a compiled
    // executable keeps only the branches for its own platform.
    if (
      process.platform === "darwin" &&
      os === SupportedOs.MACOS &&
      this.#config.homebrew &&
      isRunningFromHomebrewCellar(this.#config.homebrew.formula)
    ) {
      return InstallMethod.HOMEBREW;
    }
    if (
      process.platform === "linux" &&
      os === SupportedOs.LINUX &&
      this.#config.linuxScript &&
      isLinuxScriptInstall()
    ) {
      return InstallMethod.LINUX_SCRIPT;
    }

    // Everything else needs an external process spawn (`brew list`, `winget list`) to confirm -
    // cache the resolved method so that spawn only ever happens once per keystore.
    const cached = await this.#getCachedInstallMethod();
    if (cached !== undefined) {
      return cached;
    }

    let detected: InstallMethod | undefined;
    if (
      process.platform === "darwin" &&
      os === SupportedOs.MACOS &&
      this.#config.homebrew &&
      (await isHomebrewInstalled(this.#spawnService, this.#config.homebrew))
    ) {
      detected = InstallMethod.HOMEBREW;
    } else if (
      process.platform === "win32" &&
      os === SupportedOs.WINDOWS &&
      this.#config.winget &&
      (await isWingetInstalled(this.#spawnService, this.#config.winget))
    ) {
      detected = InstallMethod.WINGET;
    } else if (this.#config.githubRelease) {
      detected = InstallMethod.GITHUB_RELEASE;
    }

    if (detected !== undefined) {
      await this.#cacheInstallMethod(detected);
    }
    return detected;
  }

  // The opportunistic startup check (see getUpgradeCheckResult()) runs detached from
  // UpgradeServiceProvider.initService()'s own await chain, so it can still be running after that
  // scoped KeyValueService access window has closed - a KeyValueService call landing after that
  // point throws (or could land under a different service's scope entirely). Treat any such
  // failure as "caching unavailable right now" rather than letting it fail the whole check.
  async #safeKeyValueCall<T>(op: () => Promise<T>): Promise<T | undefined> {
    try {
      return await op();
    } catch (error) {
      logger.debug(() => `KeyValueService access failed, skipping cache: ${error}`);
      return undefined;
    }
  }

  async #getCachedInstallMethod(): Promise<InstallMethod | undefined> {
    if (!this.#keyValueService) {
      return undefined;
    }
    const keyValueService = this.#keyValueService;
    const has = await this.#safeKeyValueCall(() => keyValueService.has(INSTALL_METHOD_CACHE_KEY));
    if (!has) {
      return undefined;
    }
    const cached = await this.#safeKeyValueCall(() =>
      keyValueService.get<CachedInstallMethod>(INSTALL_METHOD_CACHE_KEY),
    );
    if (!cached || Date.now() - cached.checkedAt >= CACHE_TTL_MILLIS) {
      return undefined;
    }
    return cached.method;
  }

  async #cacheInstallMethod(method: InstallMethod): Promise<void> {
    if (this.#keyValueService) {
      const keyValueService = this.#keyValueService;
      await this.#safeKeyValueCall(() =>
        keyValueService.set(INSTALL_METHOD_CACHE_KEY, { method, checkedAt: Date.now() }),
      );
    }
  }

  public async checkForUpgrade(installMethodOverride?: InstallMethod): Promise<UpgradeCheckResult> {
    const os = this.detectOs();
    const arch = this.detectArch();
    if (!os || !arch || !this.#isPlatformSupported(os, arch)) {
      return { status: "unsupported" };
    }

    const installMethod = installMethodOverride ?? (await this.detectInstallMethod(os));
    if (!installMethod) {
      return { status: "unsupported" };
    }

    const versionLookup = await this.#getLatestVersion(installMethod);
    if (!versionLookup.ok) {
      return { status: "failed", error: versionLookup.error };
    }

    const currentVersion = this.#cliConfig.version;
    const coercedCurrent = semver.coerce(currentVersion);
    const coercedLatest = semver.coerce(versionLookup.version);
    if (!coercedCurrent || !coercedLatest) {
      return {
        status: "failed",
        error: new Error(
          `Unable to compare versions '${currentVersion}' and '${versionLookup.version}'`,
        ),
      };
    }

    return {
      status: "checked",
      currentVersion,
      latestVersion: versionLookup.version,
      updateAvailable: semver.gt(coercedLatest, coercedCurrent),
      os,
      arch,
      installMethod,
    };
  }

  public async upgrade(installMethodOverride?: InstallMethod): Promise<UpgradeResult> {
    const oldVersion = this.#cliConfig.version;
    const checkResult =
      installMethodOverride !== undefined
        ? await this.checkForUpgrade(installMethodOverride)
        : await this.getUpgradeCheckResult();
    if (checkResult.status === "unsupported") {
      return {
        ok: false,
        oldVersion,
        error: new Error("No upgrade location configured for the detected platform"),
      };
    }
    if (checkResult.status === "failed") {
      return { ok: false, oldVersion, error: checkResult.error };
    }
    if (!this.#spawnService) {
      return { ok: false, oldVersion, error: new Error("SpawnService is not available") };
    }
    if (checkResult.installMethod === InstallMethod.GITHUB_RELEASE && !this.#fetchService) {
      return { ok: false, oldVersion, error: new Error("FetchService is not available") };
    }

    if (this.#printerService) {
      await this.#printerService.showSpinner(`Installing version ${checkResult.latestVersion}...`);
    }

    try {
      if (this.#printerService) {
        await this.#printerService.hideSpinner();
      }
      const spawnService = this.#spawnService!;
      const printerService = this.#printerService;
      switch (checkResult.installMethod) {
        case InstallMethod.LINUX_SCRIPT:
          await upgradeViaLinuxScript(spawnService, printerService, this.#config.linuxScript!);
          break;
        case InstallMethod.HOMEBREW:
          await upgradeViaHomebrew(
            spawnService,
            printerService,
            this.#config.homebrew!,
            checkResult.latestVersion,
          );
          break;
        case InstallMethod.WINGET:
          await upgradeViaWinget(spawnService, printerService, this.#config.winget!);
          break;
        case InstallMethod.GITHUB_RELEASE:
          await upgradeViaGithubRelease(
            spawnService,
            this.#fetchService!,
            printerService,
            this.#config.githubRelease!,
            this.#cliConfig.name,
            checkResult.os,
            checkResult.arch,
          );
          break;
      }
      return { ok: true, oldVersion, newVersion: checkResult.latestVersion };
    } catch (error) {
      return { ok: false, oldVersion, error: error as Error };
    }
  }

  #isPlatformSupported(os: SupportedOs, arch: SupportedArch): boolean {
    return this.#config.supportedPlatforms.some(
      (platform) => platform.os === os && platform.arch === arch,
    );
  }

  async #getLatestVersion(installMethod: InstallMethod): Promise<VersionLookupResult> {
    const cacheKey = `${LATEST_VERSION_CACHE_KEY_PREFIX}${installMethod}`;
    const keyValueService = this.#keyValueService;
    if (keyValueService) {
      const has = await this.#safeKeyValueCall(() => keyValueService.has(cacheKey));
      if (has) {
        const cached = await this.#safeKeyValueCall(() =>
          keyValueService.get<CachedLatestVersion>(cacheKey),
        );
        if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MILLIS) {
          return { ok: true, version: cached.version };
        }
      }
    }

    const result = await this.#lookupLatestVersion(installMethod);
    if (result.ok && keyValueService) {
      await this.#safeKeyValueCall(() =>
        keyValueService.set(cacheKey, { version: result.version, checkedAt: Date.now() }),
      );
    }
    return result;
  }

  async #lookupLatestVersion(installMethod: InstallMethod): Promise<VersionLookupResult> {
    switch (installMethod) {
      case InstallMethod.GITHUB_RELEASE:
      case InstallMethod.LINUX_SCRIPT:
        return getLatestGithubReleaseVersion(this.#fetchService, this.#config.githubRelease);
      case InstallMethod.HOMEBREW:
        return getLatestHomebrewVersion(this.#fetchService, this.#config.homebrew);
      case InstallMethod.WINGET:
        return getLatestWingetVersion(this.#spawnService, this.#config.winget);
    }
  }
}
