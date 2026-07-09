import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";

export function getCLIConfig(name = "foo"): CLIConfig {
  return {
    name,
    description: "bar",
    version: "foobar",
  };
}
