import process from "node:process";
import { realpathSync } from "node:fs";
import { mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
  SPAWN_SERVICE_ID,
  SupportedArch,
  SupportedOs,
  type UpgradeService,
} from "@flowscripter/dynamic-cli-framework-api";
import semver from "semver";
import type { UpgradeLocationsConfig } from "./UpgradeLocationsConfig.ts";
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
// there's one cache, not two. The banner task only ever reads this key (kv.has()/kv.get()) - it
// never calls checkForUpgrade()/getUpgradeCheckResult() live, since checking live would stall
// startup on the network/spawn calls checkForUpgrade() makes.
export const UPGRADE_CHECK_CACHE_KEY = "upgrade-check-result";

type VersionLookupResult =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly error: Error };

function describeSpawnFailure(result: Extract<SpawnResult, { ok: false }>): string {
  return "timedOut" in result
    ? "timed out"
    : (result.error?.message ?? `exit code ${result.exitCode}`);
}

export function describeUpgradeCheckResult(result: UpgradeCheckResult): string {
  return result.status === "failed"
    ? `Upgrade check result: failed - ${result.error.message}`
    : `Upgrade check result: ${JSON.stringify(result)}`;
}

const OS_LABELS: Record<SupportedOs, string> = {
  [SupportedOs.LINUX]: "Linux",
  [SupportedOs.MACOS]: "MacOS",
  [SupportedOs.WINDOWS]: "Windows",
};

export default class DefaultUpgradeService implements UpgradeService {
  #context: Context | undefined;
  #upgradeCheckPromise: Promise<UpgradeCheckResult> | undefined;
  readonly #config: UpgradeLocationsConfig;
  readonly #cliConfig: CLIConfig;

  public constructor(config: UpgradeLocationsConfig, cliConfig: CLIConfig) {
    this.#config = config;
    this.#cliConfig = cliConfig;
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

  // Mirrors SpawnInterfaceAdapter's plugin:add/plugin:remove pattern: wrap a spawned command's
  // output in a quoted, marked block that's cleared on success (so a clean install stays quiet)
  // but left on screen on failure (so the diagnostic output remains visible).
  async #spawnQuoted(command: ReadonlyArray<string>): Promise<SpawnResult> {
    const spawnService = this.#spawnService!;
    const printerService = this.#printerService;
    if (!printerService) {
      return spawnService.spawn(command, { mode: "ignore" });
    }

    printerService.startQuote();
    printerService.startMark();

    // onOutput is synchronous and may be called concurrently for stdout/stderr lines, but
    // printerService.info() is async and must not be invoked concurrently with itself - queue
    // writes so they're applied one at a time, in call order.
    let writeQueue: Promise<void> = Promise.resolve();
    const onOutput = (line: string): void => {
      writeQueue = writeQueue.then(() => printerService.info(`${line}\n`));
    };

    const result = await spawnService.spawn(command, { mode: "wrapped", onOutput });
    await writeQueue;

    printerService.endQuote();
    printerService.endMark();
    if (result.ok) {
      await printerService.clearMarked();
    } else {
      printerService.discardMark();
    }
    return result;
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

  public detectOs(): SupportedOs | undefined {
    switch (process.platform) {
      case "linux":
        return SupportedOs.LINUX;
      case "darwin":
        return SupportedOs.MACOS;
      case "win32":
        return SupportedOs.WINDOWS;
      default:
        return undefined;
    }
  }

  public detectArch(): SupportedArch | undefined {
    switch (process.arch) {
      case "x64":
        return SupportedArch.X64;
      case "arm64":
        return SupportedArch.ARM64;
      default:
        return undefined;
    }
  }

  public async detectInstallMethod(os: SupportedOs): Promise<InstallMethod | undefined> {
    // Cheap, no-spawn signals are checked first and always win over the cache below, so a fresh
    // install is picked up immediately rather than waiting on a stale cached method.
    if (
      os === SupportedOs.MACOS &&
      this.#config.homebrew &&
      this.#isRunningFromHomebrewCellar(this.#config.homebrew.formula)
    ) {
      return InstallMethod.HOMEBREW;
    }
    if (os === SupportedOs.LINUX && this.#config.linuxScript && this.#isLinuxScriptInstall()) {
      return InstallMethod.LINUX_SCRIPT;
    }

    // Everything else needs an external process spawn (`brew list`, `winget list`) to confirm -
    // cache the resolved method so that spawn only ever happens once per keystore.
    const cached = await this.#getCachedInstallMethod();
    if (cached !== undefined) {
      return cached;
    }

    let detected: InstallMethod | undefined;
    if (os === SupportedOs.MACOS && this.#config.homebrew && (await this.#isHomebrewInstalled())) {
      detected = InstallMethod.HOMEBREW;
    } else if (
      os === SupportedOs.WINDOWS &&
      this.#config.winget &&
      (await this.#isWingetInstalled())
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

  public async checkForUpgrade(
    osOverride?: SupportedOs,
    archOverride?: SupportedArch,
    installMethodOverride?: InstallMethod,
  ): Promise<UpgradeCheckResult> {
    const os = osOverride ?? this.detectOs();
    const arch = archOverride ?? this.detectArch();
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

  public async upgrade(
    osOverride?: SupportedOs,
    archOverride?: SupportedArch,
    installMethodOverride?: InstallMethod,
  ): Promise<UpgradeResult> {
    const oldVersion = this.#cliConfig.version;
    const hasOverride =
      osOverride !== undefined || archOverride !== undefined || installMethodOverride !== undefined;
    const checkResult = hasOverride
      ? await this.checkForUpgrade(osOverride, archOverride, installMethodOverride)
      : await this.getUpgradeCheckResult();
    if (checkResult.status === "unsupported") {
      return {
        ok: false,
        oldVersion,
        error: new Error("No upgrade location configured for the detected or requested platform"),
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
      switch (checkResult.installMethod) {
        case InstallMethod.LINUX_SCRIPT:
          await this.#upgradeViaLinuxScript();
          break;
        case InstallMethod.HOMEBREW:
          await this.#upgradeViaHomebrew();
          break;
        case InstallMethod.WINGET:
          await this.#upgradeViaWinget();
          break;
        case InstallMethod.GITHUB_RELEASE:
          await this.#upgradeViaGithubRelease(checkResult.os, checkResult.arch);
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

  // Homebrew relinks a formula's installed binary from its Cellar directory into a `bin/` symlink,
  // so resolving the running executable's real path confirms a homebrew install without spawning
  // `brew`, which has a slow cold start - avoiding it keeps the background upgrade-check
  // StartupTask (see UpgradeServiceProvider) fast even though it now runs to completion.
  #isRunningFromHomebrewCellar(formula: string): boolean {
    let realExecutable = process.execPath;
    try {
      realExecutable = realpathSync(process.execPath);
    } catch {
      // process.execPath may not resolve on disk (e.g. a fabricated path in tests) - fall back to
      // the unresolved path rather than treating that as "not installed".
    }
    return realExecutable.includes(`/Cellar/${formula}/`);
  }

  async #isHomebrewInstalled(): Promise<boolean> {
    if (!this.#spawnService || !this.#config.homebrew) {
      return false;
    }
    const result = await this.#spawnService.spawn(
      ["brew", "list", "--versions", this.#config.homebrew.formula],
      { mode: "ignore", longRunning: false },
    );
    return result.ok;
  }

  async #isWingetInstalled(): Promise<boolean> {
    if (!this.#spawnService || !this.#config.winget) {
      return false;
    }
    const result = await this.#spawnService.spawn(
      ["winget", "list", "--id", this.#config.winget.packageId],
      { mode: "ignore", longRunning: false },
    );
    return result.ok;
  }

  #isLinuxScriptInstall(): boolean {
    return process.execPath.startsWith("/usr/local/bin/");
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
        return this.#getLatestGithubReleaseVersion();
      case InstallMethod.HOMEBREW:
        return this.#getLatestHomebrewVersion();
      case InstallMethod.WINGET:
        return this.#getLatestWingetVersion();
    }
  }

  async #getLatestGithubReleaseVersion(): Promise<VersionLookupResult> {
    if (!this.#config.githubRelease) {
      return { ok: false, error: new Error("No githubRelease location configured") };
    }
    if (!this.#fetchService) {
      return { ok: false, error: new Error("FetchService is not available") };
    }
    const { owner, repo } = this.#config.githubRelease;
    try {
      // Uses the plain web redirect rather than the api.github.com REST endpoint, since the
      // latter's unauthenticated rate limit (60 requests/hour/IP) is easily exhausted, e.g. by
      // CI runners sharing an IP pool.
      const response = await this.#fetchService.fetch(
        `https://github.com/${owner}/${repo}/releases/latest`,
        { redirect: "manual" },
      );
      const location = response.headers.get("location");
      const version = location ? /\/releases\/tag\/v?([^/]+)$/.exec(location)?.[1] : undefined;
      if (!version) {
        return {
          ok: false,
          error: new Error(
            `Unexpected response resolving latest release for ${owner}/${repo}: HTTP ${response.status}`,
          ),
        };
      }
      return { ok: true, version };
    } catch (error) {
      return {
        ok: false,
        error: new Error(`Failed to fetch latest GitHub release for ${owner}/${repo}: ${error}`),
      };
    }
  }

  async #getLatestHomebrewVersion(): Promise<VersionLookupResult> {
    if (!this.#config.homebrew) {
      return { ok: false, error: new Error("No homebrew location configured") };
    }
    if (!this.#fetchService) {
      return { ok: false, error: new Error("FetchService is not available") };
    }
    const { tap, formula } = this.#config.homebrew;
    const [tapOwner, tapName] = tap.split("/");
    if (!tapOwner || !tapName) {
      return { ok: false, error: new Error(`Invalid homebrew tap '${tap}'`) };
    }
    try {
      const response = await this.#fetchService.fetch(
        `https://raw.githubusercontent.com/${tapOwner}/homebrew-${tapName}/main/${formula}.rb`,
      );
      if (!response.ok) {
        return {
          ok: false,
          error: new Error(
            `Failed to fetch homebrew formula for ${tap}/${formula}: HTTP ${response.status}`,
          ),
        };
      }
      const text = await response.text();
      const version = /version\s+"v?([^"]+)"/.exec(text)?.[1];
      if (!version) {
        return {
          ok: false,
          error: new Error(`Could not parse version from homebrew formula ${tap}/${formula}`),
        };
      }
      return { ok: true, version };
    } catch (error) {
      return {
        ok: false,
        error: new Error(`Failed to fetch homebrew formula for ${tap}/${formula}: ${error}`),
      };
    }
  }

  async #getLatestWingetVersion(): Promise<VersionLookupResult> {
    if (!this.#config.winget) {
      return { ok: false, error: new Error("No winget location configured") };
    }
    if (!this.#spawnService) {
      return { ok: false, error: new Error("SpawnService is not available") };
    }
    const lines: string[] = [];
    const result = await this.#spawnService.spawn(
      ["winget", "show", "--id", this.#config.winget.packageId],
      {
        mode: "wrapped",
        longRunning: false,
        onOutput: (line) => lines.push(line),
      },
    );
    if (!result.ok) {
      return { ok: false, error: new Error(`winget show failed: ${describeSpawnFailure(result)}`) };
    }
    for (const line of lines) {
      const match = /Version:\s*(\S+)/.exec(line);
      if (match?.[1]) {
        return { ok: true, version: match[1] };
      }
    }
    return { ok: false, error: new Error("Could not parse version from winget output") };
  }

  async #upgradeViaLinuxScript(): Promise<void> {
    const { scriptUrl } = this.#config.linuxScript!;
    const result = await this.#spawnQuoted(["sh", "-c", `curl -fsSL ${scriptUrl} | sh`]);
    if (!result.ok) {
      throw new Error(`Install script failed: ${describeSpawnFailure(result)}`);
    }
  }

  async #upgradeViaHomebrew(): Promise<void> {
    const { tap, formula } = this.#config.homebrew!;
    const result = await this.#spawnQuoted(["brew", "upgrade", `${tap}/${formula}`]);
    if (!result.ok) {
      throw new Error(`brew upgrade failed: ${describeSpawnFailure(result)}`);
    }
  }

  async #upgradeViaWinget(): Promise<void> {
    const { packageId } = this.#config.winget!;
    const result = await this.#spawnQuoted([
      "winget",
      "upgrade",
      "--id",
      packageId,
      "--silent",
      "--accept-package-agreements",
      "--accept-source-agreements",
    ]);
    if (!result.ok) {
      throw new Error(`winget upgrade failed: ${describeSpawnFailure(result)}`);
    }
  }

  async #upgradeViaGithubRelease(os: SupportedOs, arch: SupportedArch): Promise<void> {
    const { owner, repo, assetPattern } = this.#config.githubRelease!;
    // macOS release assets use "aarch64" rather than "arm64" for the arm64 build; x64 (including
    // Intel Macs) always uses "x64" regardless of os.
    const archLabel =
      arch === SupportedArch.X64 ? "x64" : os === SupportedOs.MACOS ? "aarch64" : "arm64";
    const assetName = assetPattern.replace("{os}", OS_LABELS[os]).replace("{arch}", archLabel);
    const url = `https://github.com/${owner}/${repo}/releases/latest/download/${assetName}`;

    // longRunning: true gets cooperative Ctrl-C handling during what can be the slowest step of
    // the upgrade.
    const response = await this.#fetchService!.fetch(url, { longRunning: true });
    if (!response.ok) {
      throw new Error(`Failed to download release asset '${assetName}': HTTP ${response.status}`);
    }
    const archiveData = await response.arrayBuffer();

    const tmpDir = await mkdtemp(join(tmpdir(), "upgrade-"));
    const archivePath = join(tmpDir, assetName);
    await Bun.write(archivePath, archiveData);

    const currentExecutable = process.execPath;

    if (os === SupportedOs.WINDOWS) {
      const extractResult = await this.#spawnQuoted([
        "powershell",
        "-Command",
        `Expand-Archive -Path '${archivePath}' -DestinationPath '${tmpDir}' -Force`,
      ]);
      if (!extractResult.ok) {
        throw new Error("Failed to extract release archive");
      }
      const extractedBinary = join(tmpDir, `${this.#cliConfig.name}.exe`);
      const oldPath = `${currentExecutable}.old.exe`;

      // Best-effort cleanup of a stale "<exe>.old.exe" left behind by a *previous* upgrade run.
      // Windows won't let us delete the just-renamed-aside exe while this process still has it
      // open/mapped - that can only happen once we're no longer holding it, i.e. at the start of
      // the NEXT invocation, before we move today's running exe aside. Ignore failures: the file
      // may not exist, or may still be locked (e.g. another instance still running). Not quoted -
      // this is expected to fail silently, there's nothing worth showing the user.
      await this.#spawnService!.spawn(["cmd", "/c", "del", "/f", "/q", oldPath], {
        mode: "ignore",
      });

      const moveResult = await this.#spawnQuoted([
        "cmd",
        "/c",
        "move",
        "/y",
        currentExecutable,
        oldPath,
      ]);
      if (!moveResult.ok) {
        throw new Error("Failed to move current executable aside");
      }
      const copyResult = await this.#spawnQuoted([
        "cmd",
        "/c",
        "copy",
        "/y",
        extractedBinary,
        currentExecutable,
      ]);
      if (!copyResult.ok) {
        throw new Error("Failed to copy new executable into place");
      }
    } else {
      const extractResult = await this.#spawnQuoted(["unzip", "-o", archivePath, "-d", tmpDir]);
      if (!extractResult.ok) {
        throw new Error("Failed to extract release archive");
      }
      const extractedBinary = join(tmpDir, this.#cliConfig.name);

      // Extract into a staging file in the SAME directory as the running executable (not
      // os.tmpdir(), which may be a different filesystem/mount), then atomically rename it over
      // currentExecutable. This avoids ETXTBSY: the kernel refuses to open-for-write the inode
      // mapped as a running process's text segment, but rename() only swaps the directory entry
      // to point at a different inode - the running process keeps executing from its original,
      // now-unlinked-but-still-open inode until it next execs/restarts.
      const stagingDir = await mkdtemp(join(dirname(currentExecutable), ".upgrade-"));
      try {
        const stagingBinary = join(stagingDir, this.#cliConfig.name);
        await Bun.write(stagingBinary, Bun.file(extractedBinary));
        await this.#spawnService!.spawn(["chmod", "+x", stagingBinary], { mode: "ignore" });
        await rename(stagingBinary, currentExecutable);
      } finally {
        await rm(stagingDir, { recursive: true, force: true });
      }
    }
  }
}
