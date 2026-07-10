import process from "node:process";
import BaseCLI from "./BaseCLI.ts";
import type { RunResult } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import type BaseCLIFeatureOptions from "./BaseCLIFeatureOptions.ts";
import { Writable } from "node:stream";
import TtyTerminal from "../terminal/TtyTerminal.ts";
import NonTtyTerminal from "../terminal/NonTtyTerminal.ts";
import TtyKeyReader from "../terminal/TtyKeyReader.ts";
import TtyStyler from "../terminal/TtyStyler.ts";
import supportsColor from "supports-color";
import supportsHyperlinks from "../terminal/supportsHyperlinks.ts";
import getLogger from "../util/logger.ts";

const logger = getLogger("DefaultRuntimeCLI");

/**
 * Default Bun implementation of a {@link CLI} using `process.stdout`, `process.stderr` and `process.argv`.
 *
 * Degrades gracefully when `stdin`, `stdout` or `stderr` are not TTYs (e.g. piped or redirected):
 * color and hyperlinks are disabled, prompting is disabled, and non-TTY streams are wrapped in a
 * {@link NonTtyTerminal} rather than the usual {@link TtyTerminal}.
 */
export default class DefaultRuntimeCLI extends BaseCLI {
  constructor(cliConfig: CLIConfig, options?: BaseCLIFeatureOptions) {
    const stdinIsTty = process.stdin.isTTY === true;
    const stdoutIsTty = process.stdout.isTTY === true;
    const stderrIsTty = process.stderr.isTTY === true;

    logger.debug(
      () =>
        `stdin isTTY: ${stdinIsTty}, stdout isTTY: ${stdoutIsTty}, stderr isTTY: ${stderrIsTty}`,
    );

    const stdoutTerminal = stdoutIsTty
      ? new TtyTerminal(process.stdout)
      : new NonTtyTerminal(process.stdout);
    const stderrTerminal = stderrIsTty
      ? new TtyTerminal(process.stderr)
      : new NonTtyTerminal(process.stderr);

    logger.debug(
      () =>
        `stdout terminal: ${
          stdoutIsTty ? "TtyTerminal" : "NonTtyTerminal"
        }, stderr terminal: ${stderrIsTty ? "TtyTerminal" : "NonTtyTerminal"}`,
    );

    const colorLevel = stderrIsTty
      ? supportsColor.stderr === false
        ? 1
        : supportsColor.stderr.level
      : 0;

    logger.debug(() => `color level: ${colorLevel}`);

    const keyReader = stdinIsTty ? new TtyKeyReader(process.stdin) : undefined;

    logger.debug(() => `keyReader constructed: ${keyReader !== undefined}`);

    const promptingEnabled = stdinIsTty && stderrIsTty;

    logger.debug(() => `promptingEnabled default: ${promptingEnabled}`);

    super(
      cliConfig,
      Writable.toWeb(process.stdout),
      Writable.toWeb(process.stderr),
      supportsColor.stdout !== false,
      supportsColor.stderr !== false,
      stdoutTerminal,
      stderrTerminal,
      new TtyStyler(colorLevel, supportsHyperlinks(process.stderr)),
      keyReader,
      { promptingEnabled, ...options },
    );
  }

  override async run(): Promise<RunResult> {
    const runResult = await super.run(process.argv.slice(2));
    process.exit(runResult.runState);
  }
}
