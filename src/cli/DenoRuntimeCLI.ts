import BaseCLI from "./BaseCLI.ts";
import type RunResult from "../api/RunResult.ts";
import { RunState } from "../api/RunResult.ts";
import type CLIConfig from "../api/CLIConfig.ts";

/**
 * Deno implementation of a {@link CLI} using `Deno.stdout`, `Deno.stderr` and `Deno.args`.
 */
export default class DenoRuntimeCLI extends BaseCLI {
  /**
   * Constructor configures the instance with the specified CLI application details
   * and making use of `Deno.stdout` and `Deno.stderr`.
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
      Deno.stdout.writable,
      Deno.stderr.writable,
      envVarsEnabled,
      configEnabled,
      keyValueServiceEnabled,
      validateAllCommands,
    );
  }

  /**
   * Run the CLI using `Deno.args` for the arguments and call `Deno.exit()` passing the
   * {@link RunState} value resulting from the invocation.
   */
  override async run(): Promise<RunResult> {
    const runResult = await super.run(Deno.args);
    if (runResult.runState === RunState.RUNTIME_ERROR) {
      console.error(runResult.error);
    }
    Deno.exit(runResult.runState);
  }
}
