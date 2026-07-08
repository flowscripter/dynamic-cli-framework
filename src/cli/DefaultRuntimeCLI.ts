import process from "node:process";
import BaseCLI from "./BaseCLI.ts";
import type RunResult from "../api/RunResult.ts";
import type CLIConfig from "../api/CLIConfig.ts";
import type BaseCLIFeatureOptions from "../api/BaseCLIFeatureOptions.ts";
import { Writable } from "node:stream";
import TtyTerminal from "../terminal/TtyTerminal.ts";
import TtyKeyReader from "../terminal/TtyKeyReader.ts";
import TtyStyler from "../terminal/TtyStyler.ts";
import supportsColor from "supports-color";
import supportsHyperlinks from "../terminal/supportsHyperlinks.ts";

/**
 * Default Bun implementation of a {@link CLI} using `process.stdout`, `process.stderr` and `process.argv`.
 */
export default class DefaultRuntimeCLI extends BaseCLI {
  constructor(cliConfig: CLIConfig, options?: BaseCLIFeatureOptions) {
    super(
      cliConfig,
      Writable.toWeb(process.stdout),
      Writable.toWeb(process.stderr),
      supportsColor.stdout !== false,
      supportsColor.stderr !== false,
      new TtyTerminal(process.stdout),
      new TtyTerminal(process.stderr),
      new TtyStyler(
        supportsColor.stderr === false ? 1 : supportsColor.stderr.level,
        supportsHyperlinks(process.stderr),
      ),
      new TtyKeyReader(process.stdin),
      { promptingEnabled: process.stdin.isTTY === true, ...options },
    );
  }

  override async run(): Promise<RunResult> {
    const runResult = await super.run(process.argv.slice(2));
    process.exit(runResult.runState);
  }
}
