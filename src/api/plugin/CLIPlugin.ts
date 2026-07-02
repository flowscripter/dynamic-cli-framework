import type { Plugin, ExtensionDescriptor } from "@flowscripter/dynamic-plugin-framework";
import type CommandFactory from "./CommandFactory.ts";
import { DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT } from "./CommandFactory.ts";
import type ServiceProviderFactory from "./ServiceProviderFactory.ts";
import { DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT } from "./ServiceProviderFactory.ts";

/**
 * {@link ExtensionDescriptor} for a {@link CommandFactory} extension.
 */
export interface CommandFactoryExtensionDescriptor extends ExtensionDescriptor {
  readonly extensionPoint: typeof DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT;
  readonly factory: {
    create(hostData?: Map<string, string>): Promise<CommandFactory>;
  };
}

/**
 * {@link ExtensionDescriptor} for a {@link ServiceProviderFactory} extension.
 */
export interface ServiceProviderFactoryExtensionDescriptor extends ExtensionDescriptor {
  readonly extensionPoint: typeof DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT;
  readonly factory: {
    create(hostData?: Map<string, string>): Promise<ServiceProviderFactory>;
  };
}

/**
 * A {@link Plugin} for {@link DynamicPluginRuntimeCLI} whose {@link extensionDescriptors} are
 * limited to the {@link CommandFactory} and {@link ServiceProviderFactory} extension points.
 */
export default interface CLIPlugin extends Plugin {
  readonly extensionDescriptors: ReadonlyArray<
    CommandFactoryExtensionDescriptor | ServiceProviderFactoryExtensionDescriptor
  >;
}
