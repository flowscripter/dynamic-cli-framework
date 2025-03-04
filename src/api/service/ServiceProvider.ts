import type Command from "../command/Command.ts";
import type Context from "../Context.ts";
import type CLIConfig from "../CLIConfig.ts";

/**
 * Information regarding a service instance provided by a {@link ServiceProvider}.
 */
export interface ServiceInfo {
  /**
   * Optional, a service in the {@link Context}.
   */
  readonly service?: unknown;

  /**
   * Zero or more {@link Command} instances related to the service which should be registered.
   */
  readonly commands: ReadonlyArray<Command>;
}

/**
 * Interface allowing services to be provided to the CLI.
 */
export interface ServiceProvider {
  /**
   * The ID which identifies the service provided.
   */
  readonly serviceId: string;

  /**
   * Used to determine the order in which multiple service instances will be initialised. Higher values
   * will be initialised before lower values.
   */
  readonly servicePriority: number;

  /**
   * Return {@link ServiceInfo} containing the service and any commands which should be registered in the CLI.
   *
   * @param cliConfig the {@link CLIConfig} for the CLI.
   */
  provide(cliConfig: CLIConfig): Promise<ServiceInfo>;

  /**
   * Initialise the service. This will be invoked AFTER any {@link GlobalModifierCommand} provided in the
   * {@link ServiceInfo} have been invoked (if specified as CLI arguments or CLI configuration).
   *
   * NOTE: Other services within the provided context will only have been initialised if they have a higher
   * {@link servicePriority} value than the current service.
   *
   * @param context the {@link Context} in which the CLI is running.
   */
  initService(context: Context): Promise<void>;
}
