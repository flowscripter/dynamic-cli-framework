import CLIConfig from "../../src/api/CLIConfig.ts";

export function getCLIConfig(): CLIConfig {
  return {
    name: "foo",
    description: "bar",
    version: "foobar",
  };
}
