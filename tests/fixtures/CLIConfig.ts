import type CLIConfig from "../../src/api/CLIConfig.ts";

export function getCLIConfig(name = "foo"): CLIConfig {
  return {
    name,
    description: "bar",
    version: "foobar",
  };
}
