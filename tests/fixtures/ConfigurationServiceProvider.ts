import ConfigurationServiceProvider from "../../src/service/configuration/ConfigurationServiceProvider.ts";
import type {
  ArgumentSingleValueType,
  ArgumentValues,
} from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";

class DummyConfigurationServiceProvider extends ConfigurationServiceProvider {
  constructor(
    servicePriority: number,
    defaultsData: Map<string, ArgumentValues | ArgumentSingleValueType>,
  ) {
    super(servicePriority, false, true);

    this.defaultsData = defaultsData;
  }

  public override initService(_context: Context): Promise<void> {
    return Promise.resolve();
  }
}

export function getConfigurationServiceProvider(
  servicePriority: number,
  defaultsData: Map<string, ArgumentValues | ArgumentSingleValueType>,
) {
  return new DummyConfigurationServiceProvider(servicePriority, defaultsData);
}
