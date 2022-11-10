/**
 * Interface to be implemented by a CLI application.
 */
import { RunResult } from "./RunResult.ts";

export default interface CLI {
  /**
   * Run the CLI with the provided arguments which do not include the invoked executable name.
   *
   * @param args the arguments to parse
   *
   * @return result of parsing arguments and running appropriate {@link Command} instances.
   */
  run(args: string[]): Promise<RunResult>;
}
