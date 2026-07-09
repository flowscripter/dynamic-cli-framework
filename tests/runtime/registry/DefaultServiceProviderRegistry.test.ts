import { describe, expect, test } from "bun:test";
import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import DefaultServiceProviderRegistry from "../../../src/runtime/registry/DefaultServiceProviderRegistry.ts";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";

function getServiceProvider(serviceId: string, servicePriority: number): ServiceProvider {
  return {
    serviceId,
    servicePriority,
    getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
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

describe("DefaultServiceProviderRegistry tests", () => {
  test("Check for ordering of service providers", () => {
    const serviceProvider1 = getServiceProvider("foo1", 1);
    const serviceProvider2 = getServiceProvider("foo2", 2);
    const serviceProviderRegistry = new DefaultServiceProviderRegistry();

    serviceProviderRegistry.addServiceProvider(serviceProvider1);
    serviceProviderRegistry.addServiceProvider(serviceProvider2);

    const orderedServices = serviceProviderRegistry.getServiceProviders();
    expect(orderedServices[0]!.servicePriority).toEqual(2);
    expect(orderedServices[1]!.servicePriority).toEqual(1);
  });
});
