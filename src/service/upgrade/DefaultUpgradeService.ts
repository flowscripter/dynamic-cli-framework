import process from "node:process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CLIConfig,
  ShutdownService,
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
// so its version-check network/spawn calls must never be allowed to stall CLI startup.
export const VERSION_CHECK_TIMEOUT_MS = 250;

function describeSpawnFailure(result: Extract<SpawnResult, { ok: false }>): string {
  return "timedOut" in result
    ? "timed out"
    : (result.error?.message ?? `exit code ${result.exitCode}`);
}

const OS_LABELS: Record<SupportedOs, string> = {
  [SupportedOs.LINUX]: "Linux",
  [SupportedOs.MACOS]: "MacOS",
  [SupportedOs.WINDOWS]: "Windows",
};

export default class DefaultUpgradeService implements UpgradeService {
  #spawnService: SpawnService | undefined;
  #shutdownService: ShutdownService | undefined;
  #upgradeCheckPromise: Promise<UpgradeCheckResult | undefined> | undefined;
  readonly #config: UpgradeLocationsConfig;
  readonly #cliConfig: CLIConfig;

  public constructor(config: UpgradeLocationsConfig, cliConfig: CLIConfig) {
    this.#config = config;
    this.#cliConfig = cliConfig;
  }

  public setDependencies(spawnService: SpawnService, shutdownService?: ShutdownService): void {
    this.#spawnService = spawnService;
    this.#shutdownService = shutdownService;
  }

  public getUpgradeCheckResult(waitForResult = false): Promise<UpgradeCheckResult | undefined> {
    if (!this.#upgradeCheckPromise) {
      this.#upgradeCheckPromise = this.checkForUpgrade();
    }
    if (waitForResult) {
      return this.#upgradeCheckPromise;
    }
    return Promise.race([
      this.#upgradeCheckPromise,
      new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), VERSION_CHECK_TIMEOUT_MS),
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
  ): Promise<UpgradeCheckResult | undefined> {
    const os = osOverride ?? this.detectOs();
    const arch = archOverride ?? this.detectArch();
    if (!os || !arch || !this.#isPlatformSupported(os, arch)) {
      return undefined;
    }

    const installMethod = installMethodOverride ?? (await this.detectInstallMethod(os));
    if (!installMethod) {
      return undefined;
    }

    const latestVersion = await this.#getLatestVersion(installMethod);
    if (!latestVersion) {
      return undefined;
    }

    const currentVersion = this.#cliConfig.version;
    const coercedCurrent = semver.coerce(currentVersion);
    const coercedLatest = semver.coerce(latestVersion);
    if (!coercedCurrent || !coercedLatest) {
      logger.debug(() => `Unable to compare versions '${currentVersion}' and '${latestVersion}'`);
      return undefined;
    }

    return {
      currentVersion,
      latestVersion,
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
    if (!checkResult) {
      return {
        ok: false,
        oldVersion,
        error: new Error("No upgrade location configured for the detected or requested platform"),
      };
    }
    if (!this.#spawnService) {
      return { ok: false, oldVersion, error: new Error("SpawnService is not available") };
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
      { stdio: "wrapped", longRunning: false, timeoutMs: VERSION_CHECK_TIMEOUT_MS },
    );
    return result.ok;
  }

  async #isWingetInstalled(): Promise<boolean> {
    if (!this.#spawnService || !this.#config.winget) {
      return false;
    }
    const result = await this.#spawnService.spawn(
      ["winget", "list", "--id", this.#config.winget.packageId],
      { stdio: "wrapped", longRunning: false, timeoutMs: VERSION_CHECK_TIMEOUT_MS },
    );
    return result.ok;
  }

  #isLinuxScriptInstall(): boolean {
    return process.execPath.startsWith("/usr/local/bin/");
  }

  async #getLatestVersion(installMethod: InstallMethod): Promise<string | undefined> {
    switch (installMethod) {
      case InstallMethod.GITHUB_RELEASE:
      case InstallMethod.LINUX_SCRIPT:
        return this.#getLatestGithubReleaseVersion();
      case InstallMethod.HOMEBREW:
        return this.#getLatestHomebrewVersion();
      case InstallMethod.WINGET:
        return this.#getLatestWingetVersion();
      default:
        return undefined;
    }
  }

  async #getLatestGithubReleaseVersion(): Promise<string | undefined> {
    if (!this.#config.githubRelease) {
      return undefined;
    }
    const { owner, repo } = this.#config.githubRelease;
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
        { signal: AbortSignal.timeout(VERSION_CHECK_TIMEOUT_MS) },
      );
      if (!response.ok) {
        return undefined;
      }
      const data = (await response.json()) as { tag_name?: string };
      return data.tag_name?.replace(/^v/, "");
    } catch (error) {
      logger.debug(() => `Failed to fetch latest GitHub release for ${owner}/${repo}: ${error}`);
      return undefined;
    }
  }

  async #getLatestHomebrewVersion(): Promise<string | undefined> {
    if (!this.#config.homebrew) {
      return undefined;
    }
    const { tap, formula } = this.#config.homebrew;
    const [tapOwner, tapName] = tap.split("/");
    if (!tapOwner || !tapName) {
      return undefined;
    }
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${tapOwner}/homebrew-${tapName}/main/${formula}.rb`,
        { signal: AbortSignal.timeout(VERSION_CHECK_TIMEOUT_MS) },
      );
      if (!response.ok) {
        return undefined;
      }
      const text = await response.text();
      return /version\s+"v?([^"]+)"/.exec(text)?.[1];
    } catch (error) {
      logger.debug(() => `Failed to fetch homebrew formula for ${tap}/${formula}: ${error}`);
      return undefined;
    }
  }

  async #getLatestWingetVersion(): Promise<string | undefined> {
    if (!this.#spawnService || !this.#config.winget) {
      return undefined;
    }
    const lines: string[] = [];
    const result = await this.#spawnService.spawn(
      ["winget", "show", "--id", this.#config.winget.packageId],
      {
        stdio: "wrapped",
        longRunning: false,
        timeoutMs: VERSION_CHECK_TIMEOUT_MS,
        onOutput: (line) => lines.push(line),
      },
    );
    if (!result.ok) {
      return undefined;
    }
    for (const line of lines) {
      const match = /Version:\s*(\S+)/.exec(line);
      if (match?.[1]) {
        return match[1];
      }
    }
    return undefined;
  }

  async #upgradeViaLinuxScript(): Promise<void> {
    const { scriptUrl } = this.#config.linuxScript!;
    const result = await this.#spawnService!.spawn(["sh", "-c", `curl -fsSL ${scriptUrl} | sh`]);
    if (!result.ok) {
      throw new Error(`Install script failed: ${describeSpawnFailure(result)}`);
    }
  }

  async #upgradeViaHomebrew(): Promise<void> {
    const { tap, formula } = this.#config.homebrew!;
    const result = await this.#spawnService!.spawn(["brew", "upgrade", `${tap}/${formula}`]);
    if (!result.ok) {
      throw new Error(`brew upgrade failed: ${describeSpawnFailure(result)}`);
    }
  }

  async #upgradeViaWinget(): Promise<void> {
    const { packageId } = this.#config.winget!;
    const result = await this.#spawnService!.spawn([
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
    const archLabel =
      os === SupportedOs.MACOS ? "aarch64" : arch === SupportedArch.X64 ? "x64" : "arm64";
    const assetName = assetPattern.replace("{os}", OS_LABELS[os]).replace("{arch}", archLabel);
    const url = `https://github.com/${owner}/${repo}/releases/latest/download/${assetName}`;

    // Downloading the release asset but enter long-running mode to get cooperative
    // Ctrl-C handling during what can be the slowest step of the upgrade.
    this.#shutdownService?.enterLongRunningMode();
    let archiveData: ArrayBuffer;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download release asset '${assetName}': HTTP ${response.status}`);
      }
      archiveData = await response.arrayBuffer();
    } finally {
      this.#shutdownService?.leaveLongRunningMode();
    }

    const tmpDir = await mkdtemp(join(tmpdir(), "upgrade-"));
    const archivePath = join(tmpDir, assetName);
    await Bun.write(archivePath, archiveData);

    const currentExecutable = process.execPath;

    if (os === SupportedOs.WINDOWS) {
      const extractResult = await this.#spawnService!.spawn([
        "powershell",
        "-Command",
        `Expand-Archive -Path '${archivePath}' -DestinationPath '${tmpDir}' -Force`,
      ]);
      if (!extractResult.ok) {
        throw new Error("Failed to extract release archive");
      }
      const extractedBinary = join(tmpDir, `${this.#cliConfig.name}.exe`);
      const oldPath = `${currentExecutable}.old.exe`;
      const moveResult = await this.#spawnService!.spawn([
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
      const copyResult = await this.#spawnService!.spawn([
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
      const extractResult = await this.#spawnService!.spawn([
        "unzip",
        "-o",
        archivePath,
        "-d",
        tmpDir,
      ]);
      if (!extractResult.ok) {
        throw new Error("Failed to extract release archive");
      }
      const extractedBinary = join(tmpDir, this.#cliConfig.name);
      await Bun.write(currentExecutable, Bun.file(extractedBinary));
      await this.#spawnService!.spawn(["chmod", "+x", currentExecutable]);
    }
  }
}
