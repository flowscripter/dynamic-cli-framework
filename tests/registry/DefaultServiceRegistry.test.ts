import { assertEquals, describe, it } from "../test_deps.ts";
import DefaultServiceRegistry from "../../src/registry/DefaultServiceRegistry.ts";
import { Service } from "../../mod.ts";

function getService(initPriority: number, id: string): Service {
  return {
    initPriority,
    init: () =>
      Promise.resolve({
        serviceInstances: [{ serviceId: id, instance: {} }],
        commands: [],
      }),
  };
}

describe("DefaultServiceRegistry", () => {
  it("Check for ordering of servics", () => {
    const service1 = getService(1, "foo1");
    const service2 = getService(2, "foo2");
    const serviceRegistry = new DefaultServiceRegistry();

    serviceRegistry.addService(service1);
    serviceRegistry.addService(service2);

    const orderedServices = serviceRegistry.getServices();
    assertEquals(orderedServices[0].initPriority, 2);
    assertEquals(orderedServices[1].initPriority, 1);
  });
});
