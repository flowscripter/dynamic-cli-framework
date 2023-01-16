/**
 * State of a {@link CLI} after invocation.
 */
import Command from "./command/Command.ts";
import { InvalidArgument } from "./runtime/Parser.ts";

export enum RunState {
  /**
   * Arguments were successfully parsed and the specified command(s) were successfully executed.
   */
  SUCCESS = 0,

  /**
   * The arguments supplied were invalid or could not be parsed.
   */
  PARSE_ERROR = 1,

  /**
   * Arguments were successfully parsed but no command was discovered.
   */
  NO_COMMAND = 2,

  /**
   * Arguments were successfully parsed and command(s) discovered but command execution failed.
   */
  EXECUTION_ERROR = 3,

  /**
   * General runtime error related to the framework.
   */
  RUNTIME_ERROR = 4,
}

/**
 * Result of a {@link CLI} invocation.
 */
export default interface RunResult {
  /**
   * The state after processing the invocation.
   */
  readonly runState: RunState;

  /**
   * Populated if {@link runState} is {@link RunState.SUCCESS}, {@link RunState.PARSE_ERROR} or {@link RunState.EXECUTION_ERROR}.
   */
  readonly command?: Command;

  /**
   * Populated if {@link runState} is {@link RunState.PARSE_ERROR}
   */
  readonly invalidArguments?: ReadonlyArray<InvalidArgument>;

  /**
   * Populated if {@link runState} is {@link RunState.EXECUTION_ERROR} or {@link RunState.RUNTIME_ERROR}.
   */
  readonly error?: Error;
}
