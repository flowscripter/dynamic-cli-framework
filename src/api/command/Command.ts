/**
 * Common interface for all command types.
 */
export default interface Command {
  /**
   * Name of the command.
   *
   * Must consist of alphanumeric non-whitespace ASCII or `_` and `-` characters. Cannot start with `-`.
   */
  readonly name: string;

  /**
   * Optional description of the command.
   */
  readonly description?: string;

  /**
   * Optionally enable support for populating argument values via configuration. If this is `true` then
   * default argument values may be sourced using a configuration source provided by the CLI runtime.
   */
  readonly enableConfiguration?: boolean;
}
