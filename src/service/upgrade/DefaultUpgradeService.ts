import process from "node:process";
import { mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
  CLIConfig,
  FetchService,
  SpawnResult,
  SpawnService,
  UpgradeCheckResult,
  UpgradeResult,
} from "@flowscripter/dynamic-cli-framework-api";
import {
  InstallMethod,
  SupportedArch,
  SupportedOs,
  type UpgradeService,
} from "@flowscripter/dynamic-cli-framework-api";
import semver from "semver";
import type { UpgradeLocationsConfig } from "./UpgradeLocationsConfig.ts";
import getLogger from "../../util/logger.ts";

const logger = getLogger("DefaultUpgradeService");

// checkForUpgrade() runs opportunistically on every CLI invocation (via BannerServiceProvider),
// so that opportunistic call is raced against this timeout so it never stalls CLI startup.
// A deliberate caller (waitForResult=true, e.g. the `upgrade` command) awaits checkForUpgrade()
// directly with no timeout, so its underlying network/spawn calls are never artificially cut off.
export const VERSION_CHECK_TIMEOUT_MS = 250;

type VersionLookupResult =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly error: Error };

function describeSpawnFailure(result: Extract<SpawnResult, { ok: false }>): string {
  return "timedOut" in result
    ? "timed out"
    : (result.error?.message ?? `exit code ${result.exitCode}`);
}

// JSON.stringify() on an Error drops message/stack (non-enumerable own properties), logging as
// "error":{} and hiding the actual failure reason - surface it explicitly instead.
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
  #spawnService: SpawnService | undefined;
  #fetchService: FetchService | undefined;
  #upgradeCheckPromise: Promise<UpgradeCheckResult> | undefined;
  readonly #config: UpgradeLocationsConfig;
  readonly #cliConfig: CLIConfig;

  public constructor(config: UpgradeLocationsConfig, cliConfig: CLIConfig) {
    this.#config = config;
    this.#cliConfig = cliConfig;
  }

  public setDependencies(
    spawnService: SpawnService | undefined,
    fetchService: FetchService | undefined,
  ): void {
    this.#spawnService = spawnService;
    this.#fetchService = fetchService;
  }

  public getUpgradeCheckResult(waitForResult = false): Promise<UpgradeCheckResult> {
    if (!this.#upgradeCheckPromise) {
      logger.debug(() => "Starting upgrade check");
      // Only cache a non-"failed" result. A "failed" result can come from a transient issue
      // (e.g. a network blip, or the opportunistic startup check racing past
      // VERSION_CHECK_TIMEOUT_MS before checkForUpgrade() itself resolves) - caching that would
      // permanently deny a later, deliberate caller (e.g. the `upgrade` command explicitly
      // waiting via waitForResult=true) any chance of a fresh attempt for the rest of this
      // process's lifetime.
      this.#upgradeCheckPromise = this.checkForUpgrade().then((result) => {
        logger.debug(() => describeUpgradeCheckResult(result));
        if (result.status === "failed") {
          this.#upgradeCheckPromise = undefined;
        }
        return result;
      });
    }
    if (waitForResult) {
      return this.#upgradeCheckPromise;
    }
    return Promise.race([
      this.#upgradeCheckPromise,
      new Promise<UpgradeCheckResult>((resolve) =>
        setTimeout(() => resolve({ status: "pending" }), VERSION_CHECK_TIMEOUT_MS),
      ),
    ]);
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
    if (os === SupportedOs.MACOS && this.#config.homebrew && (await this.#isHomebrewInstalled())) {
      return InstallMethod.HOMEBREW;
    }
    if (os === SupportedOs.WINDOWS && this.#config.winget && (await this.#isWingetInstalled())) {
      return InstallMethod.WINGET;
    }
    if (os === SupportedOs.LINUX && this.#config.linuxScript && this.#isLinuxScriptInstall()) {
      return InstallMethod.LINUX_SCRIPT;
    }
    if (this.#config.githubRelease) {
      return InstallMethod.GITHUB_RELEASE;
    }
    return undefined;
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
      : await this.getUpgradeCheckResult(true);
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
    if (checkResult.status === "pending") {
      // Unreachable: checkForUpgrade() and getUpgradeCheckResult(true) always run to completion.
      return { ok: false, oldVersion, error: new Error("Upgrade check did not complete") };
    }
    if (!this.#spawnService) {
      return { ok: false, oldVersion, error: new Error("SpawnService is not available") };
    }
    if (checkResult.installMethod === InstallMethod.GITHUB_RELEASE && !this.#fetchService) {
      return { ok: false, oldVersion, error: new Error("FetchService is not available") };
    }

    try {
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
    const result = await this.#spawnService!.spawn(["sh", "-c", `curl -fsSL ${scriptUrl} | sh`], {
      mode: "ignore",
    });
    if (!result.ok) {
      throw new Error(`Install script failed: ${describeSpawnFailure(result)}`);
    }
  }

  async #upgradeViaHomebrew(): Promise<void> {
    const { tap, formula } = this.#config.homebrew!;
    const result = await this.#spawnService!.spawn(["brew", "upgrade", `${tap}/${formula}`], {
      mode: "ignore",
    });
    if (!result.ok) {
      throw new Error(`brew upgrade failed: ${describeSpawnFailure(result)}`);
    }
  }

  async #upgradeViaWinget(): Promise<void> {
    const { packageId } = this.#config.winget!;
    const result = await this.#spawnService!.spawn(
      [
        "winget",
        "upgrade",
        "--id",
        packageId,
        "--silent",
        "--accept-package-agreements",
        "--accept-source-agreements",
      ],
      { mode: "ignore" },
    );
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
      const extractResult = await this.#spawnService!.spawn(
        [
          "powershell",
          "-Command",
          `Expand-Archive -Path '${archivePath}' -DestinationPath '${tmpDir}' -Force`,
        ],
        { mode: "ignore" },
      );
      if (!extractResult.ok) {
        throw new Error("Failed to extract release archive");
      }
      const extractedBinary = join(tmpDir, `${this.#cliConfig.name}.exe`);
      const oldPath = `${currentExecutable}.old.exe`;

      // Best-effort cleanup of a stale "<exe>.old.exe" left behind by a *previous* upgrade run.
      // Windows won't let us delete the just-renamed-aside exe while this process still has it
      // open/mapped - that can only happen once we're no longer holding it, i.e. at the start of
      // the NEXT invocation, before we move today's running exe aside. Ignore failures: the file
      // may not exist, or may still be locked (e.g. another instance still running).
      await this.#spawnService!.spawn(["cmd", "/c", "del", "/f", "/q", oldPath], {
        mode: "ignore",
      });

      const moveResult = await this.#spawnService!.spawn(
        ["cmd", "/c", "move", "/y", currentExecutable, oldPath],
        { mode: "ignore" },
      );
      if (!moveResult.ok) {
        throw new Error("Failed to move current executable aside");
      }
      const copyResult = await this.#spawnService!.spawn(
        ["cmd", "/c", "copy", "/y", extractedBinary, currentExecutable],
        { mode: "ignore" },
      );
      if (!copyResult.ok) {
        throw new Error("Failed to copy new executable into place");
      }
    } else {
      const extractResult = await this.#spawnService!.spawn(
        ["unzip", "-o", archivePath, "-d", tmpDir],
        {
          mode: "ignore",
        },
      );
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
