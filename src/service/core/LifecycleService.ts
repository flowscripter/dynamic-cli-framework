import Service, { ServiceInstance } from "../../api/service/Service.ts";
import Lifecycle, {
  LIFECYCLE_SERVICE_ID,
} from "../../api/service/core/Lifecycle.ts";
import DefaultLifecycle from "./DefaultLifecycle.ts";
import Command from "../../api/command/Command.ts";

/**
 * Exposes a {@link Lifecycle} instance as a {@link Service}.
 */
export default class LifecycleService implements Service {
  readonly initPriority: number;
  readonly lifecycle: Lifecycle;

  /**
   * Create an instance of the service with the specified details.
   *
   * @param initPriority the priority of the service.
   */
  public constructor(
    initPriority: number,
  ) {
    this.initPriority = initPriority;
    this.lifecycle = new DefaultLifecycle();
  }

  public init(): Promise<{
    readonly serviceInstances: ReadonlyArray<ServiceInstance>;
    readonly commands: ReadonlyArray<Command>;
  }> {
    const serviceInstances: Array<ServiceInstance> = [
      {
        serviceId: LIFECYCLE_SERVICE_ID,
        instance: this.lifecycle,
      },
    ];

    return Promise.resolve({
      serviceInstances,
      commands: [],
    });
  }
}
