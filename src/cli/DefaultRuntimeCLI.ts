import process from "node:process";
import BaseCLI from "./BaseCLI.ts";
import type RunResult from "../api/RunResult.ts";
import { RunState } from "../api/RunResult.ts";
import type CLIConfig from "../api/CLIConfig.ts";
import { Writable } from "node:stream";
import TtyTerminal from "../service/printer/terminal/TtyTerminal.ts";
import TtyStyler from "../service/printer/terminal/TtyStyler.ts";
import supportsColor from "supports-color";

/**
 * Default Bun and NodeJS implementation of a {@link CLI} using `process.stdout`, `process.stderr` and `process.argv`.
 */
export default class DefaultRuntimeCLI extends BaseCLI {
  /**
   * Constructor configures the instance with the specified CLI application details
   * and making use of `process.stdout` and `process.stderr`.
   */
  constructor(
    cliConfig: CLIConfig,
    envVarsEnabled = false,
    configEnabled = false,
    keyValueServiceEnabled = false,
    validateAllCommands = false,
  ) {
    super(
      cliConfig,
      Writable.toWeb(process.stdout),
      Writable.toWeb(process.stderr),
      supportsColor.stdout !== false,
      supportsColor.stderr !== false,
      new TtyTerminal(process.stderr),
      new TtyStyler(
        supportsColor.stderr === false ? 1 : supportsColor.stderr.level,
      ),
      envVarsEnabled,
      configEnabled,
      keyValueServiceEnabled,
      validateAllCommands,
    );
  }

  /**
   * Run the CLI using `process.argv` for the arguments and call `process.exit()` passing the
   * {@link RunState} value resulting from the invocation.
   */
  override async run(): Promise<RunResult> {
    const runResult = await super.run(process.argv);
    if (runResult.runState === RunState.RUNTIME_ERROR) {
      console.error(runResult.error);
    }
    process.exit(runResult.runState);
  }
}
