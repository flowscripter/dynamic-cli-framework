import DefaultServiceProviderRegistry from "../../src/runtime/registry/DefaultServiceProviderRegistry.ts";
import type ServiceProviderRegistry from "../../src/runtime/registry/ServiceProviderRegistry.ts";
import type { ServiceProvider } from "../../src/api/service/ServiceProvider.ts";

export function getServiceProviderRegistry(
  serviceProviders?: Array<ServiceProvider>,
): ServiceProviderRegistry {
  const serviceProviderRegistry = new DefaultServiceProviderRegistry([]);

  if (serviceProviders) {
    serviceProviders.forEach((serviceProvider) =>
      serviceProviderRegistry.addServiceProvider(serviceProvider)
    );
  }
  return serviceProviderRegistry;
}
