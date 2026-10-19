import { describe, expect, test } from "bun:test";
import DefaultContext from "../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";

describe("DefaultContext tests", () => {
  test("Check for duplicate service ID", () => {
    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance("foo", {});
    expect(() => context.addServiceInstance("foo", {})).toThrow();
  });

  test("Check lookup by ID", () => {
    const context = new DefaultContext(getCLIConfig());

    context.addServiceInstance("foo", "bar");

    expect(context.getServiceById("foo")).toEqual("bar");
  });

  test("isTty defaults to false and can be specified", () => {
    expect(new DefaultContext(getCLIConfig()).isTty).toEqual({
      stdin: false,
      stdout: false,
      stderr: false,
    });
    const isTty = { stdin: true, stdout: false, stderr: true };
    expect(new DefaultContext(getCLIConfig(), isTty).isTty).toEqual(isTty);
  });
});
