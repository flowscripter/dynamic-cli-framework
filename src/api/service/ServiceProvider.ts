import GlobalModifierCommand from "../command/GlobalModifierCommand.ts";
import Context from "../Context.ts";

/**
 * Information regarding a service instance provided by a {@link ServiceProvider}.
 */
export interface ServiceInfo {
  /**
   * The ID which identifies the service.
   */
  readonly serviceId: string;

  /**
   * The actual service instance.
   */
  readonly service: unknown;

  /**
   * Zero or more {@link GlobalModifierCommand} instances related to the service which should be registered.
   */
  readonly globalModifierCommands: ReadonlyArray<GlobalModifierCommand>;
}

/**
 * Interface allowing services to be provided to the CLI.
 */
export default interface ServiceProvider {
  /**
   * Used to determine the order in which multiple service instances will be initialised. Higher values
   * will be initialised before lower values.
   */
  readonly servicePriority: number;

  /**
   * Return {@link ServiceInfo} describing the service and any commands which should be registered in the CLI.
   *
   * @param context the {@link Context} in which the CLI is running.
   */
  getServiceInfo(context: Context): Promise<ServiceInfo>;

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
