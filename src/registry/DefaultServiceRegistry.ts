import ServiceRegistry from "../api/registry/ServiceRegistry.ts";
import Service from "../api/service/Service.ts";

/**
 * Default implementation of a {@link ServiceRegistry}.
 */
export default class DefaultServiceRegistry implements ServiceRegistry {
  private readonly services: Array<Service> = [];

  public constructor(services?: ReadonlyArray<Service>) {
    if (services !== undefined) {
      this.services.push(...services);
    }
  }

  public addService(service: Service): void {
    this.services.push(service);
  }

  public getServices(): ReadonlyArray<Service> {
    return this.services.sort((a, b) => b.initPriority - a.initPriority);
  }
}
