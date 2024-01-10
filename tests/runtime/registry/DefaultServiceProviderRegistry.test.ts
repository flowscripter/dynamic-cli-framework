import { assertEquals, describe, it } from "../../test_deps.ts";
import ServiceProvider, {
  ServiceInfo,
} from "../../../src/api/service/ServiceProvider.ts";
import DefaultServiceProviderRegistry from "../../../src/runtime/registry/DefaultServiceProviderRegistry.ts";
import Context from "../../../src/api/Context.ts";

function getServiceProvider(
  serviceId: string,
  servicePriority: number,
): ServiceProvider {
  return {
    serviceId,
    servicePriority,
    provide(_context: Context): Promise<ServiceInfo> {
      return Promise.resolve({
        service: {},
        commands: [],
      });
    },
    initService(_context: Context): Promise<void> {
      return Promise.resolve(undefined);
    },
  };
}

describe("DefaultServiceRegistry", () => {
  it("Check for ordering of service providers", () => {
    const serviceProvider1 = getServiceProvider("foo1", 1);
    const serviceProvider2 = getServiceProvider("foo2", 2);
    const serviceProviderRegistry = new DefaultServiceProviderRegistry();

    serviceProviderRegistry.addServiceProvider(serviceProvider1);
    serviceProviderRegistry.addServiceProvider(serviceProvider2);

    const orderedServices = serviceProviderRegistry.getServiceProviders();
    assertEquals(orderedServices[0].servicePriority, 2);
    assertEquals(orderedServices[1].servicePriority, 1);
  });
});
