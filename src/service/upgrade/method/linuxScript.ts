import process from "node:process";
import type { PrinterService, SpawnService } from "@flowscripter/dynamic-cli-framework-api";
import type { LinuxScriptLocation } from "../UpgradeLocationsConfig.ts";
import { describeSpawnFailure, spawnQuoted } from "./shared.ts";

export function isLinuxScriptInstall(): boolean {
  return process.execPath.startsWith("/usr/local/bin/");
}

export async function upgradeViaLinuxScript(
  spawnService: SpawnService,
  printerService: PrinterService | undefined,
  location: LinuxScriptLocation,
): Promise<void> {
  const result = await spawnQuoted(spawnService, printerService, [
    "sh",
    "-c",
    `curl -fsSL ${location.scriptUrl} | sh`,
  ]);
  if (!result.ok) {
    throw new Error(`Install script failed: ${describeSpawnFailure(result)}`);
  }
}
