import process from "node:process";
import { realpathSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  getLatestHomebrewVersion,
  isHomebrewInstalled,
  isRunningFromHomebrewCellar,
  parseBrewInstalledVersions,
  resolveHomebrewOptExecutable,
  upgradeViaHomebrew,
} from "../../../../src/service/upgrade/method/homebrew.ts";
import { getFakePrinterService, getFetchService, getSpawnService } from "./helpers.ts";

const location = { tap: "flowscripter/tap", formula: "example-cli" };

describe("parseBrewInstalledVersions", () => {
  const parse = (output: string) =>
    parseBrewInstalledVersions(output, "example-cli").map((v) => v.version);

  test("parses a plain version", () => {
    expect(parse("example-cli 3.0.11")).toEqual(["3.0.11"]);
  });

  test("parses a v-prefixed version", () => {
    expect(parse("example-cli v3.0.11")).toEqual(["3.0.11"]);
  });

  test("parses multiple installed versions", () => {
    expect(parse("example-cli 3.0.10 v3.0.11")).toEqual(["3.0.10", "3.0.11"]);
  });

  test("strips a revision suffix", () => {
    expect(parse("example-cli 3.0.11_2")).toEqual(["3.0.11"]);
  });

  test("handles surrounding whitespace and newlines", () => {
    expect(parse("  example-cli   3.0.10\n  3.0.11 \n")).toEqual(["3.0.10", "3.0.11"]);
  });

  test("returns nothing for empty output or a name only", () => {
    expect(parse("")).toEqual([]);
    expect(parse("example-cli")).toEqual([]);
  });
});

describe("getLatestHomebrewVersion", () => {
  test("resolves the latest version from the tap formula file", async () => {
    const fetchService = getFetchService((url) => {
      expect(url).toEqual(
        "https://raw.githubusercontent.com/flowscripter/homebrew-tap/main/example-cli.rb",
      );
      return new Response('version "v9.9.9"', { status: 200 });
    });
    expect(await getLatestHomebrewVersion(fetchService, location)).toEqual({
      ok: true,
      version: "9.9.9",
    });
  });

  test("fails when not configured, without a FetchService or with an invalid tap", async () => {
    const fetchService = getFetchService(() => new Response("", { status: 200 }));
    expect((await getLatestHomebrewVersion(fetchService, undefined)).ok).toBe(false);
    expect((await getLatestHomebrewVersion(undefined, location)).ok).toBe(false);
    expect(
      (await getLatestHomebrewVersion(fetchService, { tap: "invalid", formula: "example-cli" })).ok,
    ).toBe(false);
  });

  test("fails on an HTTP error, an unparseable formula or a fetch error", async () => {
    const notFound = getFetchService(() => new Response("", { status: 404 }));
    const notFoundResult = await getLatestHomebrewVersion(notFound, location);
    expect(!notFoundResult.ok && notFoundResult.error.message).toContain("HTTP 404");

    const noVersion = getFetchService(() => new Response("nothing here", { status: 200 }));
    const noVersionResult = await getLatestHomebrewVersion(noVersion, location);
    expect(!noVersionResult.ok && noVersionResult.error.message).toContain("Could not parse");

    const rejected = getFetchService(() => Promise.reject(new Error("network error")));
    const rejectedResult = await getLatestHomebrewVersion(rejected, location);
    expect(!rejectedResult.ok && rejectedResult.error.message).toContain("network error");
  });
});

describe("isHomebrewInstalled", () => {
  test("reflects the result of brew list", async () => {
    const installed = getSpawnService(() => ({ ok: true, exitCode: 0 }));
    expect(await isHomebrewInstalled(installed.spawnService, location)).toBe(true);
    expect(installed.calls[0]?.command).toEqual(["brew", "list", "--versions", "example-cli"]);

    const missing = getSpawnService(() => ({ ok: false, exitCode: 1 }));
    expect(await isHomebrewInstalled(missing.spawnService, location)).toBe(false);
  });

  test("is false without a SpawnService or location", async () => {
    const { spawnService } = getSpawnService(() => ({ ok: true, exitCode: 0 }));
    expect(await isHomebrewInstalled(undefined, location)).toBe(false);
    expect(await isHomebrewInstalled(spawnService, undefined)).toBe(false);
  });
});

describe("upgradeViaHomebrew", () => {
  const listOutput = (command: ReadonlyArray<string>) =>
    command[1] === "list" ? ["example-cli 9.9.9"] : [];

  test("updates, upgrades and verifies the installed version", async () => {
    const { spawnService, calls } = getSpawnService(() => ({ ok: true, exitCode: 0 }), listOutput);
    await upgradeViaHomebrew(spawnService, undefined, location, "9.9.9");
    expect(calls.map((c) => c.command)).toEqual([
      ["brew", "update"],
      ["brew", "upgrade", "flowscripter/tap/example-cli"],
      ["brew", "list", "--versions", "example-cli"],
    ]);
  });

  test("fails when brew update fails", async () => {
    const { spawnService, calls } = getSpawnService(() => ({ ok: false, exitCode: 1 }));
    await expect(upgradeViaHomebrew(spawnService, undefined, location, "9.9.9")).rejects.toThrow(
      "brew update failed",
    );
    expect(calls.map((c) => c.command)).toEqual([["brew", "update"]]);
  });

  test("fails when brew upgrade fails", async () => {
    const { spawnService } = getSpawnService((command) =>
      command[1] === "update" ? { ok: true, exitCode: 0 } : { ok: false, exitCode: 1 },
    );
    await expect(upgradeViaHomebrew(spawnService, undefined, location, "9.9.9")).rejects.toThrow(
      "brew upgrade failed",
    );
  });

  test("fails when the expected version is not installed", async () => {
    const { spawnService } = getSpawnService(
      () => ({ ok: true, exitCode: 0 }),
      (command) => (command[1] === "list" ? ["example-cli 3.0.8"] : []),
    );
    await expect(upgradeViaHomebrew(spawnService, undefined, location, "9.9.9")).rejects.toThrow(
      "9.9.9 is not installed (installed: example-cli 3.0.8)",
    );
  });

  test("accepts a v-prefixed installed version", async () => {
    const { spawnService } = getSpawnService(
      () => ({ ok: true, exitCode: 0 }),
      (command) => (command[1] === "list" ? ["example-cli v9.9.9"] : []),
    );
    await upgradeViaHomebrew(spawnService, undefined, location, "9.9.9");
  });

  test("wraps the install output in quote/mark and clears it on success", async () => {
    const { spawnService, calls } = getSpawnService(
      () => ({ ok: true, exitCode: 0 }),
      (command) => (command[1] === "list" ? ["example-cli 9.9.9"] : ["==> Upgrading example-cli"]),
    );
    const { printerService, state } = getFakePrinterService();

    await upgradeViaHomebrew(spawnService, printerService, location, "9.9.9");

    expect(calls.map((c) => c.options?.mode)).toEqual(["wrapped", "wrapped", "wrapped"]);
    expect(state.calls.filter((c) => c === "clearMarked")).toHaveLength(2);
    expect(state.infoMessages).toContain("==> Upgrading example-cli\n");
  });

  test("leaves the install output visible when it fails", async () => {
    const { spawnService } = getSpawnService(
      () => ({ ok: false, exitCode: 1 }),
      () => ["Error: formula not found"],
    );
    const { printerService, state } = getFakePrinterService();

    await expect(
      upgradeViaHomebrew(spawnService, printerService, location, "9.9.9"),
    ).rejects.toThrow();

    expect(state.calls).toContain("discardMark");
    expect(state.calls).not.toContain("clearMarked");
  });
});

describe("running executable resolution", () => {
  let originalExecPath: string;

  beforeEach(() => {
    originalExecPath = process.execPath;
  });

  afterEach(() => {
    process.execPath = originalExecPath;
  });

  test("isRunningFromHomebrewCellar matches the formula's Cellar directory", () => {
    process.execPath = "/opt/homebrew/Cellar/example-cli/1.0.0/bin/example-cli";
    expect(isRunningFromHomebrewCellar("example-cli")).toBe(true);
    expect(isRunningFromHomebrewCellar("other-cli")).toBe(false);
  });

  test("resolveHomebrewOptExecutable returns undefined when not configured", () => {
    expect(resolveHomebrewOptExecutable(undefined)).toBeUndefined();
  });

  test("resolveHomebrewOptExecutable returns undefined when not running from the Cellar", () => {
    process.execPath = "/usr/local/bin/example-cli";
    expect(resolveHomebrewOptExecutable(location)).toBeUndefined();
  });

  // Homebrew paths are POSIX paths
  test.skipIf(process.platform === "win32")(
    "resolveHomebrewOptExecutable returns the opt executable when it exists",
    async () => {
      const prefix = await mkdtemp(join(tmpdir(), "homebrew-"));
      try {
        const cellarBin = join(prefix, "Cellar", "example-cli", "1.0.0", "bin");
        const optBin = join(prefix, "opt", "example-cli", "bin");
        await mkdir(cellarBin, { recursive: true });
        await writeFile(join(cellarBin, "example-cli"), "");
        process.execPath = join(cellarBin, "example-cli");

        expect(resolveHomebrewOptExecutable(location)).toBeUndefined();

        await mkdir(optBin, { recursive: true });
        await writeFile(join(optBin, "example-cli"), "");

        // the temporary directory may itself be behind a symlink (e.g. /var on macOS)
        expect(resolveHomebrewOptExecutable(location)).toEqual(
          join(realpathSync(prefix), "opt", "example-cli", "bin", "example-cli"),
        );
      } finally {
        await rm(prefix, { recursive: true, force: true });
      }
    },
  );
});
