import type { PrinterService, SpawnService } from "@flowscripter/dynamic-cli-framework-api";
import type { WingetLocation } from "../UpgradeLocationsConfig.ts";
import { describeSpawnFailure, spawnQuoted, type VersionLookupResult } from "./shared.ts";

export async function isWingetInstalled(
  spawnService: SpawnService | undefined,
  location: WingetLocation | undefined,
): Promise<boolean> {
  if (!spawnService || !location) {
    return false;
  }
  const result = await spawnService.spawn(["winget", "list", "--id", location.packageId], {
    mode: "ignore",
    longRunning: false,
  });
  return result.ok;
}

export async function getLatestWingetVersion(
  spawnService: SpawnService | undefined,
  location: WingetLocation | undefined,
): Promise<VersionLookupResult> {
  if (!location) {
    return { ok: false, error: new Error("No winget location configured") };
  }
  if (!spawnService) {
    return { ok: false, error: new Error("SpawnService is not available") };
  }
  const lines: string[] = [];
  const result = await spawnService.spawn(["winget", "show", "--id", location.packageId], {
    mode: "wrapped",
    longRunning: false,
    onOutput: (line) => lines.push(line),
  });
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

export async function upgradeViaWinget(
  spawnService: SpawnService,
  printerService: PrinterService | undefined,
  location: WingetLocation,
): Promise<void> {
  const result = await spawnQuoted(spawnService, printerService, [
    "winget",
    "upgrade",
    "--id",
    location.packageId,
    "--silent",
    "--accept-package-agreements",
    "--accept-source-agreements",
  ]);
  if (!result.ok) {
    throw new Error(`winget upgrade failed: ${describeSpawnFailure(result)}`);
  }
}
