import ServiceRegistry from "../registry/ServiceRegistry.ts";
import CommandRegistry from "../registry/CommandRegistry.ts";
import CLIConfig from "../CLIConfig.ts";

/**
 * Interface allowing a {@link CLI} to pass context to a {@link Command} instance.
 */
export default interface Context {
  /**
   * The {@link CLIConfig} in use by the {@link CLI}
   */
  // readonly cliConfig: CLIConfig;

  // /**
  //  * The {@link CommandRegistry} in use by the {@link CLI}
  //  */
  // readonly commandRegistry: CommandRegistry;

  /**
   * The {@link ServiceRegistry} in use by the {@link CLI}
   */
  // readonly serviceRegistry: ServiceRegistry;
}
