import { assertEquals, describe, it } from "./test_deps.ts";
import DefaultCLIConfig from "../src/DefaultCLIConfig.ts";

describe("DefaultCLIConfig", () => {
  it("get values for sub-command works", () => {
    let cliConfig = new DefaultCLIConfig("foo", "bar", "1");

    assertEquals(
      cliConfig.getDefaultArgumentValuesForSubCommand("foo"),
      undefined,
    );

    cliConfig = new DefaultCLIConfig(
      "foo",
      "bar",
      "1",
      new Map([["subCommand", { goo: "gar" }]]),
    );

    assertEquals(
      cliConfig.getDefaultArgumentValuesForSubCommand("foo"),
      undefined,
    );
    assertEquals(
      cliConfig.getDefaultArgumentValuesForSubCommand("subCommand"),
      { goo: "gar" },
    );
  });

  it("get value for global command works", () => {
    let cliConfig = new DefaultCLIConfig("foo", "bar", "1");

    assertEquals(
      cliConfig.getDefaultArgumentValueForGlobalCommand("foo"),
      undefined,
    );

    cliConfig = new DefaultCLIConfig(
      "foo",
      "bar",
      "1",
      new Map(),
      new Map([["globalCommand", "gar"]]),
    );

    assertEquals(
      cliConfig.getDefaultArgumentValueForGlobalCommand("foo"),
      undefined,
    );
    assertEquals(
      cliConfig.getDefaultArgumentValueForGlobalCommand("globalCommand"),
      "gar",
    );
  });
});
