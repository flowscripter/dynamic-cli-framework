export const CONFIGURATION_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/configuration";

/**
 * Interface allowing access to CLI configuration.
 */
export default interface Configuration {
  /**
   * Return the location of configuration in use by the CLI.
   */
  getConfigLocation(): string;
}
