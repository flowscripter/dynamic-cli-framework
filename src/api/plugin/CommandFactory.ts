import type Command from "../command/Command.ts";

/**
 * Extension point identifier for {@link CommandFactory} extensions.
 *
 * Plugins register against this extension point to supply {@link Command} instances
 * that are added to the CLI before execution begins.
 */
export const DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT =
  "DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY";

/**
 * Extension interface implemented by a plugin to provide {@link Command} instances.
 *
 * A plugin registers an {@link CommandFactory} against
 * {@link DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT}. On startup,
 * {@link DynamicPluginRuntimeCLI} instantiates each factory and adds the returned
 * commands to the CLI registry before the runner executes.
 */
export default interface CommandFactory {
  /**
   * Return the {@link Command} instances provided by this factory.
   */
  getCommands(): ReadonlyArray<Command>;
}
