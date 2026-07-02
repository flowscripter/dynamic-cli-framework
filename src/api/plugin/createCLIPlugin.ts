import type CommandFactory from "./CommandFactory.ts";
import { DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT } from "./CommandFactory.ts";
import type ServiceProviderFactory from "./ServiceProviderFactory.ts";
import { DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT } from "./ServiceProviderFactory.ts";
import type CLIPlugin from "./CLIPlugin.ts";

export interface CLIPluginOptions {
  readonly commandFactory?: CommandFactory | (() => Promise<CommandFactory>);
  readonly serviceProviderFactory?:
    | ServiceProviderFactory
    | (() => Promise<ServiceProviderFactory>);
  readonly pluginData?: ReadonlyMap<string, string>;
}

/**
 * Build a {@link CLIPlugin} from optional {@link CommandFactory} and {@link ServiceProviderFactory}
 * instances (or factory functions), without needing to hand-construct extension descriptors.
 */
export default function createCLIPlugin(options: CLIPluginOptions): CLIPlugin {
  const extensionDescriptors: CLIPlugin["extensionDescriptors"][number][] = [];

  if (options.commandFactory) {
    const commandFactory = options.commandFactory;
    extensionDescriptors.push({
      extensionPoint: DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT,
      factory: {
        create: async () =>
          typeof commandFactory === "function" ? commandFactory() : commandFactory,
      },
    });
  }

  if (options.serviceProviderFactory) {
    const serviceProviderFactory = options.serviceProviderFactory;
    extensionDescriptors.push({
      extensionPoint: DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT,
      factory: {
        create: async () =>
          typeof serviceProviderFactory === "function"
            ? serviceProviderFactory()
            : serviceProviderFactory,
      },
    });
  }

  return { extensionDescriptors, pluginData: options.pluginData };
}
