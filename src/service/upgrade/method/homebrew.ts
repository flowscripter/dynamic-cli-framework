import process from "node:process";
import { existsSync, realpathSync } from "node:fs";
import { basename, join } from "node:path";
import type {
  FetchService,
  PrinterService,
  SpawnService,
} from "@flowscripter/dynamic-cli-framework-api";
import semver, { type SemVer } from "semver";
import type { HomebrewLocation } from "../UpgradeLocationsConfig.ts";
import { describeSpawnFailure, spawnQuoted, type VersionLookupResult } from "./shared.ts";

// `brew list --versions <formula>` prints the formula name followed by one or more installed
// versions, each optionally prefixed with "v" and optionally suffixed with a "_N" revision.
export function parseBrewInstalledVersions(output: string, formula: string): SemVer[] {
  const tokens = output.trim().split(/\s+/).filter(Boolean);
  if (tokens[0] === formula) {
    tokens.shift();
  }
  const versions: SemVer[] = [];
  for (const token of tokens) {
    const version = semver.coerce(token.replace(/^v/i, "").replace(/_\d+$/, ""));
    if (version) {
      versions.push(version);
    }
  }
  return versions;
}

function resolveRealExecutable(): string {
  try {
    return realpathSync(process.execPath);
  } catch {
    // process.execPath may not resolve on disk (e.g. a fabricated path in tests) - fall back to
    // the unresolved path rather than treating that as "not installed".
    return process.execPath;
  }
}

// Homebrew relinks a formula's installed binary from its Cellar directory into a `bin/` symlink,
// so resolving the running executable's real path confirms a homebrew install without spawning
// `brew`, which has a slow cold start - avoiding it keeps the background upgrade-check
// StartupTask (see UpgradeServiceProvider) fast even though it runs to completion.
export function isRunningFromHomebrewCellar(formula: string): boolean {
  return resolveRealExecutable().includes(`/Cellar/${formula}/`);
}

// The running executable lives in a version-specific Cellar directory, e.g.
// "<prefix>/Cellar/<formula>/<version>/bin/<exe>", while "<prefix>/opt/<formula>" links to the
// installed version, so the upgraded executable is "<prefix>/opt/<formula>/bin/<exe>".
export function resolveHomebrewOptExecutable(
  location: HomebrewLocation | undefined,
): string | undefined {
  if (!location) {
    return undefined;
  }
  const { formula } = location;
  const realExecutable = resolveRealExecutable();
  const cellarIndex = realExecutable.indexOf(`/Cellar/${formula}/`);
  if (cellarIndex === -1) {
    return undefined;
  }
  const prefix = realExecutable.slice(0, cellarIndex);
  const executable = join(prefix, "opt", formula, "bin", basename(realExecutable));
  return existsSync(executable) ? executable : undefined;
}

export async function isHomebrewInstalled(
  spawnService: SpawnService | undefined,
  location: HomebrewLocation | undefined,
): Promise<boolean> {
  if (!spawnService || !location) {
    return false;
  }
  const result = await spawnService.spawn(["brew", "list", "--versions", location.formula], {
    mode: "ignore",
    longRunning: false,
  });
  return result.ok;
}

export async function getLatestHomebrewVersion(
  fetchService: FetchService | undefined,
  location: HomebrewLocation | undefined,
): Promise<VersionLookupResult> {
  if (!location) {
    return { ok: false, error: new Error("No homebrew location configured") };
  }
  if (!fetchService) {
    return { ok: false, error: new Error("FetchService is not available") };
  }
  const { tap, formula } = location;
  const [tapOwner, tapName] = tap.split("/");
  if (!tapOwner || !tapName) {
    return { ok: false, error: new Error(`Invalid homebrew tap '${tap}'`) };
  }
  try {
    const response = await fetchService.fetch(
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

// The latest version is read from the tap's formula on GitHub, but `brew upgrade` only sees the
// local tap clone, which is stale until `brew update` runs. A stale tap makes `brew upgrade`
// exit 0 with "already installed", so update first and then confirm the installed version.
export async function upgradeViaHomebrew(
  spawnService: SpawnService,
  printerService: PrinterService | undefined,
  location: HomebrewLocation,
  expectedVersion: string,
): Promise<void> {
  const { tap, formula } = location;
  const updateResult = await spawnQuoted(spawnService, printerService, ["brew", "update"]);
  if (!updateResult.ok) {
    throw new Error(`brew update failed: ${describeSpawnFailure(updateResult)}`);
  }
  const result = await spawnQuoted(spawnService, printerService, [
    "brew",
    "upgrade",
    `${tap}/${formula}`,
  ]);
  if (!result.ok) {
    throw new Error(`brew upgrade failed: ${describeSpawnFailure(result)}`);
  }

  const lines: string[] = [];
  const listResult = await spawnService.spawn(["brew", "list", "--versions", formula], {
    mode: "wrapped",
    longRunning: false,
    onOutput: (line) => lines.push(line),
  });
  const installed = lines.join(" ").trim();
  const expected = semver.coerce(expectedVersion);
  const isExpectedInstalled = parseBrewInstalledVersions(installed, formula).some(
    (version) => expected !== null && semver.eq(version, expected),
  );
  if (!listResult.ok || !isExpectedInstalled) {
    throw new Error(
      `brew upgrade completed but version ${expectedVersion} is not installed (installed: ${installed || "unknown"})`,
    );
  }
}
