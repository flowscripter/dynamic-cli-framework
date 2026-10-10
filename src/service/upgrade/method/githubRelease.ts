import process from "node:process";
import { mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  type FetchService,
  type PrinterService,
  type SpawnService,
  SupportedArch,
  SupportedOs,
} from "@flowscripter/dynamic-cli-framework-api";
import type { GithubReleaseLocation } from "../UpgradeLocationsConfig.ts";
import { spawnQuoted, type VersionLookupResult } from "./shared.ts";

const OS_LABELS: Record<SupportedOs, string> = {
  [SupportedOs.LINUX]: "Linux",
  [SupportedOs.MACOS]: "MacOS",
  [SupportedOs.WINDOWS]: "Windows",
};

export async function getLatestGithubReleaseVersion(
  fetchService: FetchService | undefined,
  location: GithubReleaseLocation | undefined,
): Promise<VersionLookupResult> {
  if (!location) {
    return { ok: false, error: new Error("No githubRelease location configured") };
  }
  if (!fetchService) {
    return { ok: false, error: new Error("FetchService is not available") };
  }
  const { owner, repo } = location;
  try {
    // Uses the plain web redirect rather than the api.github.com REST endpoint, since the
    // latter's unauthenticated rate limit (60 requests/hour/IP) is easily exhausted, e.g. by
    // CI runners sharing an IP pool.
    const response = await fetchService.fetch(
      `https://github.com/${owner}/${repo}/releases/latest`,
      { redirect: "manual" },
    );
    const redirect = response.headers.get("location");
    const version = redirect ? /\/releases\/tag\/v?([^/]+)$/.exec(redirect)?.[1] : undefined;
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

export async function upgradeViaGithubRelease(
  spawnService: SpawnService,
  fetchService: FetchService,
  printerService: PrinterService | undefined,
  location: GithubReleaseLocation,
  cliName: string,
  os: SupportedOs,
  arch: SupportedArch,
): Promise<void> {
  const { owner, repo, assetPattern } = location;
  // macOS release assets use "aarch64" rather than "arm64" for the arm64 build; x64 (including
  // Intel Macs) always uses "x64" regardless of os.
  const archLabel =
    arch === SupportedArch.X64 ? "x64" : os === SupportedOs.MACOS ? "aarch64" : "arm64";
  const assetName = assetPattern.replace("{os}", OS_LABELS[os]).replace("{arch}", archLabel);
  const url = `https://github.com/${owner}/${repo}/releases/latest/download/${assetName}`;

  // longRunning: true gets cooperative Ctrl-C handling during what can be the slowest step of
  // the upgrade.
  const response = await fetchService.fetch(url, { longRunning: true });
  if (!response.ok) {
    throw new Error(`Failed to download release asset '${assetName}': HTTP ${response.status}`);
  }
  const archiveData = await response.arrayBuffer();

  const tmpDir = await mkdtemp(join(tmpdir(), "upgrade-"));
  const archivePath = join(tmpDir, assetName);
  await Bun.write(archivePath, archiveData);

  const currentExecutable = process.execPath;

  if (os === SupportedOs.WINDOWS) {
    const extractResult = await spawnQuoted(spawnService, printerService, [
      "powershell",
      "-Command",
      `Expand-Archive -Path '${archivePath}' -DestinationPath '${tmpDir}' -Force`,
    ]);
    if (!extractResult.ok) {
      throw new Error("Failed to extract release archive");
    }
    const extractedBinary = join(tmpDir, `${cliName}.exe`);
    const oldPath = `${currentExecutable}.old.exe`;

    // Best-effort cleanup of a stale "<exe>.old.exe" left behind by a *previous* upgrade run.
    // Windows won't let us delete the just-renamed-aside exe while this process still has it
    // open/mapped - that can only happen once we're no longer holding it, i.e. at the start of
    // the NEXT invocation, before we move today's running exe aside. Ignore failures: the file
    // may not exist, or may still be locked (e.g. another instance still running). Not quoted -
    // this is expected to fail silently, there's nothing worth showing the user.
    await spawnService.spawn(["cmd", "/c", "del", "/f", "/q", oldPath], {
      mode: "ignore",
    });

    const moveResult = await spawnQuoted(spawnService, printerService, [
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
    const copyResult = await spawnQuoted(spawnService, printerService, [
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
    const extractResult = await spawnQuoted(spawnService, printerService, [
      "unzip",
      "-o",
      archivePath,
      "-d",
      tmpDir,
    ]);
    if (!extractResult.ok) {
      throw new Error("Failed to extract release archive");
    }
    const extractedBinary = join(tmpDir, cliName);

    // Extract into a staging file in the SAME directory as the running executable (not
    // os.tmpdir(), which may be a different filesystem/mount), then atomically rename it over
    // currentExecutable. This avoids ETXTBSY: the kernel refuses to open-for-write the inode
    // mapped as a running process's text segment, but rename() only swaps the directory entry
    // to point at a different inode - the running process keeps executing from its original,
    // now-unlinked-but-still-open inode until it next execs/restarts.
    const stagingDir = await mkdtemp(join(dirname(currentExecutable), ".upgrade-"));
    try {
      const stagingBinary = join(stagingDir, cliName);
      await Bun.write(stagingBinary, Bun.file(extractedBinary));
      await spawnService.spawn(["chmod", "+x", stagingBinary], { mode: "ignore" });
      await rename(stagingBinary, currentExecutable);
    } finally {
      await rm(stagingDir, { recursive: true, force: true });
    }
  }
}
