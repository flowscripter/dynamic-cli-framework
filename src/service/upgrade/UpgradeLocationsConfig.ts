import type { SupportedArch, SupportedOs } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Location of a manual GitHub release asset, and how to determine the latest available version.
 */
export interface GithubReleaseLocation {
  readonly owner: string;
  readonly repo: string;

  /**
   * Asset filename pattern for a release, e.g. `"example-cli_{os}_{arch}.zip"`.
   * `{os}` is substituted with `Linux`, `MacOS` or `Windows`; `{arch}` with `x64`, `arm64` or
   * `aarch64` (macOS).
   */
  readonly assetPattern: string;
}

/**
 * Location of a Linux install script, e.g. as documented for `curl -fsSL <scriptUrl> | sh`.
 */
export interface LinuxScriptLocation {
  readonly scriptUrl: string;
}

/**
 * Location of a Homebrew tap formula, e.g. `brew install <tap>/<formula>`.
 */
export interface HomebrewLocation {
  readonly tap: string;
  readonly formula: string;
}

/**
 * Identifier of a Winget package, e.g. `winget install <packageId>`.
 */
export interface WingetLocation {
  readonly packageId: string;
}

/**
 * CLI-author supplied configuration describing which os/arch combinations a CLI supports
 * upgrading, and where to find the latest release for each supported install method.
 *
 * An install method is only usable for an os/arch combination if both its config block is
 * present here AND that combination appears in {@link supportedPlatforms}.
 */
export interface UpgradeLocationsConfig {
  readonly supportedPlatforms: ReadonlyArray<{ os: SupportedOs; arch: SupportedArch }>;
  readonly githubRelease?: GithubReleaseLocation;
  readonly linuxScript?: LinuxScriptLocation;
  readonly homebrew?: HomebrewLocation;
  readonly winget?: WingetLocation;
}
