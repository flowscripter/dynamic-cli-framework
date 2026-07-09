import type { ServiceProviderRegistry } from "@flowscripter/dynamic-cli-framework-api";
import type { ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import getLogger from "../../util/logger.ts";

const logger = getLogger("DefaultServiceProviderRegistry");

/**
 * Default implementation of a {@link ServiceProviderRegistry}.
 */
export default class DefaultServiceProviderRegistry implements ServiceProviderRegistry {
  readonly #serviceProviders: Array<ServiceProvider> = [];

  public constructor(serviceProviders?: ReadonlyArray<ServiceProvider>) {
    if (serviceProviders !== undefined) {
      this.#serviceProviders.push(...serviceProviders);
    }
  }

  public addServiceProvider(serviceProvider: ServiceProvider): void {
    logger.debug("Adding service provider for service ID: %s", serviceProvider.serviceId);
    this.#serviceProviders.push(serviceProvider);
  }

  public getServiceProviders(): ReadonlyArray<ServiceProvider> {
    return this.#serviceProviders.sort((a, b) => b.servicePriority - a.servicePriority);
  }
}
