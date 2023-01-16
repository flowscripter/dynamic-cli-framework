import { assertEquals, assertThrows, describe, it } from "../test_deps.ts";
import DefaultContext from "../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";

describe("DefaultContext", () => {
  it("Check for duplicate service ID", () => {
    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance("foo", {});
    assertThrows(() => context.addServiceInstance("foo", {}));
  });

  it("Check lookup by ID", () => {
    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance("foo", "bar");

    assertEquals(context.getServiceById("foo"), "bar");
  });
});
