import { describe, expect, test } from "bun:test";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import ConfigCommand from "../../../../src/service/configuration/command/ConfigCommand.ts";
import ConfigurationServiceProvider from "../../../../src/service/configuration/ConfigurationServiceProvider.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";

describe("ConfigCommand tests", () => {
  test("has correct name and description", () => {
    const configProvider = new ConfigurationServiceProvider(90, false, true);
    const command = new ConfigCommand(configProvider, 90);

    expect(command.name).toEqual("config");
    expect(command.description).toEqual("Set the configuration file location");
    expect(command.enableConfiguration).toEqual(true);
    expect(command.executePriority).toEqual(90);
  });

  test("execute sets config location on the provider", async () => {
    const configProvider = new ConfigurationServiceProvider(90, false, true);
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);

    const command = new ConfigCommand(configProvider, 90);

    await command.execute(context, "/tmp/my-config.json");

    expect(configProvider.configLocation).toEqual("/tmp/my-config.json");
  });
});
