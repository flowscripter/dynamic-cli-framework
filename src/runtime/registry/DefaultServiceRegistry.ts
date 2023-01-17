import ServiceRegistry from "./ServiceRegistry.ts";
import ServiceProvider from "../../api/service/ServiceProvider.ts";

/**
 * Default implementation of a {@link ServiceRegistry}.
 */
export default class DefaultServiceRegistry implements ServiceRegistry {
  private readonly services: Array<ServiceProvider> = [];

  public constructor(services?: ReadonlyArray<ServiceProvider>) {
    if (services !== undefined) {
      this.services.push(...services);
    }
  }

  public addService(service: ServiceProvider): void {
    this.services.push(service);
  }

  public getServices(): ReadonlyArray<ServiceProvider> {
    return this.services.sort((a, b) => b.initPriority - a.initPriority);
  }
}
