/**
 * Interface specifying common configuration for a {@link CLI} application.
 */
export default interface CLIConfig {
  /**
   * Name of the CLI application.
   */
  readonly name: string;

  /**
   * Optional description of the CLI application.
   */
  readonly description?: string;

  /**
   * Optional sub-message to display below the banner.
   */
  readonly subMessage?: string;

  /**
   * Version of the CLI application.
   */
  readonly version: string;
}
