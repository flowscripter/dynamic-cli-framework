/**
 * Interface to be implemented by a CLI application.
 */
import RunResult from "./RunResult.ts";
import CLIConfig from "./CLIConfig.ts";

export default interface CLI {
  /**
   * Run the CLI with the provided arguments which do not include the invoked executable name.
   *
   * @param args the arguments to parse.
   * @param cliConfig the {@link CLIConfig} for the CLI application.
   *
   * @return result of parsing arguments and running appropriate {@link Command} instances.
   */
  run(args: ReadonlyArray<string>, cliConfig: CLIConfig): Promise<RunResult>;
}
