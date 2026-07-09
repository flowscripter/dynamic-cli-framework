import DefaultServiceProviderRegistry from "../../src/runtime/registry/DefaultServiceProviderRegistry.ts";
import type { ServiceProviderRegistry, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";

export function getServiceProviderRegistry(
  serviceProviders?: Array<ServiceProvider>,
): ServiceProviderRegistry {
  const serviceProviderRegistry = new DefaultServiceProviderRegistry([]);

  if (serviceProviders) {
    serviceProviders.forEach((serviceProvider) =>
      serviceProviderRegistry.addServiceProvider(serviceProvider),
    );
  }
  return serviceProviderRegistry;
}
