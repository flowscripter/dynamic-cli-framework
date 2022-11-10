import { RunResult } from "../RunResult.ts";
import Context from "./Context.ts";
import CommandRegistry from "../registry/CommandRegistry.ts";
import { NonModifierCommand } from "../command/NonModifierCommand.ts";
import CLIConfig from "../CLIConfig.ts";

/**
 * Used by a {@link CLI} to parse arguments and run specified {@link Command} instances.
 */
export default interface Runner {
  /**
   * Parse arguments and execute the identified {@link Command} instances with identified argument values
   * using the provided {@link Context}
   *
   * @param args the command line arguments which do not include the invoked executable name.
   * @param commandRegistry the {@link CommandRegistry} to use when parsing args for commands.
   * @param cliConfig the {@link CLIConfig} for the CLI using this runner.
   * @param context the {@link context} in which to execute specified {@link Command} instances.
   * @param defaultCommand optional {@link NonModifierCommand} implementation to attempt to parse arguments for and execute if
   * no {@link NonModifierCommand} name is identified in the provided arguments.
   */
  run(
    args: ReadonlyArray<string>,
    commandRegistry: CommandRegistry,
    cliConfig: CLIConfig,
    context: Context,
    defaultCommand?: NonModifierCommand,
  ): Promise<RunResult>;
}
