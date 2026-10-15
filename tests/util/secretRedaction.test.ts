import { describe, expect, test } from "bun:test";
import { ComplexValueTypeName, ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import { REDACTED, redactSubCommandValues } from "../../src/util/secretRedaction.ts";
import populateSubCommandValues from "../../src/runtime/values/subCommandValuePopulation.ts";

const command: SubCommand = {
  name: "command",
  options: [
    { name: "user", type: ValueTypeName.STRING },
    { name: "password", type: ValueTypeName.SECRET },
    {
      name: "nested",
      type: ComplexValueTypeName.COMPLEX,
      properties: [{ name: "token", type: ValueTypeName.SECRET }],
    },
  ],
  positionals: [{ name: "key", type: ValueTypeName.SECRET }],
  execute: async (): Promise<void> => {},
};

describe("secretRedaction tests", () => {
  test("redacts SECRET options, nested properties and positionals only", () => {
    const values = { user: "u", password: "p", nested: { token: "t" }, key: "k" };
    expect(redactSubCommandValues(command, values)).toEqual({
      user: "u",
      password: REDACTED,
      nested: { token: REDACTED },
      key: REDACTED,
    });
    expect(values.password).toEqual("p");
  });

  test("population reports names of SECRET arguments given as plain args", () => {
    const result = populateSubCommandValues(
      command,
      ["--user=u", "--password", "p", "--nested.token=t", "k"],
      undefined,
    );
    expect(result.secretArgumentNames).toEqual(["password", "token", "key"]);
    expect(result.populatedArgumentValues["password"]).toEqual("p");
  });

  test("population reports no SECRET arguments when none given", () => {
    const result = populateSubCommandValues(command, ["--user=u"], { password: "p" });
    expect(result.secretArgumentNames).toBeUndefined();
  });
});
