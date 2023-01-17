/**
 * Interface allowing a {@link CLI} to pass context to a {@link Command} instance.
 */
import CLIConfig from "./CLIConfig.ts";

export default interface Context {
  /**
   * The {@link CLIConfig} in use by the {@link CLI}.
   */
  readonly cliConfig: CLIConfig;

  /**
   * Return the {@link Service} identified by the specified ID.
   *
   * @param id the ID of the {@link Service} to retrieve.
   */
  getServiceById(id: string): unknown;
}
