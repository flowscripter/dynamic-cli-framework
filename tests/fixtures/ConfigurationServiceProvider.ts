import ConfigurationServiceProvider from "../../src/service/configuration/ConfigurationServiceProvider.ts";
import {
  ArgumentSingleValueType,
  ArgumentValues,
} from "../../src/api/argument/ArgumentValueTypes.ts";
import Context from "../../src/api/Context.ts";

class DummyConfigurationServiceProvider extends ConfigurationServiceProvider {
  constructor(
    servicePriority: number,
    defaultsData: Map<string, ArgumentValues | ArgumentSingleValueType>,
  ) {
    super(servicePriority);

    this.defaultsData = defaultsData;
  }

  public initService(_context: Context): Promise<void> {
    return Promise.resolve();
  }
}

export function getConfigurationServiceProvider(
  servicePriority: number,
  defaultsData: Map<string, ArgumentValues | ArgumentSingleValueType>,
) {
  return new DummyConfigurationServiceProvider(servicePriority, defaultsData);
}
