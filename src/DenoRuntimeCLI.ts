import AbstractBaseCLI from "./AbstractBaseCLI.ts";
import RunResult, { RunState } from "./api/RunResult.ts";
import CLIConfig from "./api/CLIConfig.ts";

/**
 * Deno implementation of a {@link CLI} using `Deno.stdout`, `Deno.stderr` and `Deno.args`.
 */
export class DenoRuntimeCLI extends AbstractBaseCLI {
  /**
   * Constructor configures the instance with the specified CLI application details
   * and making use of `Deno.stdout` and `Deno.stderr`.
   */
  constructor(cliConfig: CLIConfig) {
    super(cliConfig, Deno.stdout, Deno.stderr);
  }

  /**
   * Run the CLI using `Deno.args` for the arguments and call `Deno.exit()` passing the
   * {@link RunState} value resulting from the invocation.
   */
  async run(): Promise<RunResult> {
    const runResult = await super.run(Deno.args);
    if (runResult.runState === RunState.RUNTIME_ERROR) {
      console.error(runResult.error);
    }
    Deno.exit(runResult.runState);
    return runResult;
  }
}
