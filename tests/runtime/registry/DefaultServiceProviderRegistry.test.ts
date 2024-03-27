import { assertEquals } from "../../test_deps.ts";
import {
  ServiceInfo,
  ServiceProvider,
} from "../../../src/api/service/ServiceProvider.ts";
import DefaultServiceProviderRegistry from "../../../src/runtime/registry/DefaultServiceProviderRegistry.ts";
import Context from "../../../src/api/Context.ts";
import CLIConfig from "../../../src/api/CLIConfig.ts";

function getServiceProvider(
  serviceId: string,
  servicePriority: number,
): ServiceProvider {
  return {
    serviceId,
    servicePriority,
    provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
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

Deno.test("Check for ordering of service providers", () => {
  const serviceProvider1 = getServiceProvider("foo1", 1);
  const serviceProvider2 = getServiceProvider("foo2", 2);
  const serviceProviderRegistry = new DefaultServiceProviderRegistry();

  serviceProviderRegistry.addServiceProvider(serviceProvider1);
  serviceProviderRegistry.addServiceProvider(serviceProvider2);

  const orderedServices = serviceProviderRegistry.getServiceProviders();
  assertEquals(orderedServices[0].servicePriority, 2);
  assertEquals(orderedServices[1].servicePriority, 1);
});
