/**
 * Interface for a service.
 */
import Command from "../command/Command.ts";
import Context from "../runtime/Context.ts";

export interface ServiceInstance {
  readonly serviceId: string;
  readonly instance: unknown;
}

export default interface Service {
  /**
   * Used to determine the order in which multiple service instances will be initialised. Higher values
   * will run before lower values.
   */
  readonly initPriority: number;

  /**
   * Initialise the service and return zero or more {@link ServiceInstance} to be provided
   * to commands via {@link Context.getServiceById}
   * Additionally returns zero or more commands related to the service.
   *
   * @param context the {@link Context} in which to initialise. Note that other services within the provided context
   * will only have been initialised if they have a higher {@link initPriority} value than the current service.
   */
  init(context: Context): Promise<{
    readonly serviceInstances: ReadonlyArray<ServiceInstance>;
    readonly commands: ReadonlyArray<Command>;
  }>;
}
