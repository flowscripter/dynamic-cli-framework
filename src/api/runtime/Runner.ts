import RunResult from "../RunResult.ts";
import Context from "./Context.ts";
import CommandRegistry from "../registry/CommandRegistry.ts";
import { NonModifierCommand } from "../command/NonModifierCommand.ts";
import {
  ArgumentSingleValueType,
  ArgumentValues,
} from "../argument/ArgumentValueTypes.ts";
import GlobalModifierCommand from "../command/GlobalModifierCommand.ts";

/**
 * Used by a {@link CLI} to parse arguments and run specified {@link Command} instances.
 */
export default interface Runner {
  /**
   * Parse arguments and execute the identified {@link Command} instances with identified argument values
   * using the provided {@link Context}.
   *
   * @param args the command line arguments which do not include the invoked executable name.
   * @param commandRegistry the {@link CommandRegistry} to use when parsing args for commands.
   * @param defaultArgumentValuesByCommandName a map of default values by command name.
   * @param context the {@link Context} in which to execute specified {@link Command} instances.
   * @param defaultGlobalModifierCommands optional array of {@link GlobalModifierCommand} which should always be executed. These will
   * be run without any attempt to parse a value for {@link GlobalModifierCommand.argument}.
   * @param defaultCommand optional {@link NonModifierCommand} implementation to attempt to parse arguments for and execute if
   * no {@link NonModifierCommand} name is identified in the provided arguments.
   */
  run(
    args: ReadonlyArray<string>,
    commandRegistry: CommandRegistry,
    defaultArgumentValuesByCommandName: ReadonlyMap<
      string,
      ArgumentValues | ArgumentSingleValueType
    >,
    context: Context,
    defaultGlobalModifierCommands?: ReadonlyArray<GlobalModifierCommand>,
    defaultCommand?: NonModifierCommand,
  ): Promise<RunResult>;
}
