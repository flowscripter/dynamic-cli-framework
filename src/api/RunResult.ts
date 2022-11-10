/**
 * Possible return values for a {@link CLI} invocation.
 */
export enum RunResult {
  /**
   * Arguments were successfully parsed and the specified command(s) were successfully executed.
   */
  SUCCESS = 0,

  /**
   * The arguments supplied were invalid or could not be parsed.
   */
  PARSE_ERROR = 1,

  /**
   * Arguments were successfully parsed but the specified command(s) failed.
   */
  COMMAND_ERROR = 2,

  /**
   * An error unrelated to argument parsing or command execution occurred.
   */
  GENERAL_ERROR = 3,
}
