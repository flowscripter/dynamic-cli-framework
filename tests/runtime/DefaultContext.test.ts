import { assertEquals, assertThrows } from "@std/assert";
import DefaultContext from "../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";

Deno.test("Check for duplicate service ID", () => {
  const context = new DefaultContext(getCLIConfig());

  context.addServiceInstance("foo", {});
  assertThrows(() => context.addServiceInstance("foo", {}));
});

Deno.test("Check lookup by ID", () => {
  const context = new DefaultContext(getCLIConfig());

  context.addServiceInstance("foo", "bar");

  assertEquals(context.getServiceById("foo"), "bar");
});
