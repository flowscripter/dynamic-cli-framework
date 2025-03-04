/**
 * Interface allowing a {@link CLI} to pass context to a {@link Command} instance.
 */
import type CLIConfig from "./CLIConfig.ts";

export default interface Context {
  /**
   * The {@link CLIConfig} in use by the {@link CLI}.
   */
  readonly cliConfig: CLIConfig;

  /**
   * Return the service identified by the specified ID.
   *
   * @param id the ID of the service to retrieve.
   */
  getServiceById(id: string): unknown;

  /**
   * Check if the specified service exists in the context.
   *
   * @param id the ID of the desired service.
   */
  doesServiceExist(id: string): boolean;
}
