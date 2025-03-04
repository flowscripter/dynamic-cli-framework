import type ServiceProviderRegistry from "./ServiceProviderRegistry.ts";
import type { ServiceProvider } from "../../api/service/ServiceProvider.ts";

/**
 * Default implementation of a {@link ServiceProviderRegistry}.
 */
export default class DefaultServiceProviderRegistry
  implements ServiceProviderRegistry {
  readonly #serviceProviders: Array<ServiceProvider> = [];

  public constructor(serviceProviders?: ReadonlyArray<ServiceProvider>) {
    if (serviceProviders !== undefined) {
      this.#serviceProviders.push(...serviceProviders);
    }
  }

  public addServiceProvider(serviceProvider: ServiceProvider): void {
    this.#serviceProviders.push(serviceProvider);
  }

  public getServiceProviders(): ReadonlyArray<ServiceProvider> {
    return this.#serviceProviders.sort((a, b) =>
      b.servicePriority - a.servicePriority
    );
  }
}
