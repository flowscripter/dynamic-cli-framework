import {
  ArgumentSingleValueType,
  ArgumentValues,
} from "./argument/ArgumentValueTypes.ts";

/**
 * Interface specifying common configuration for a {@link CLI} application.
 */
export default interface CLIConfig {
  /**
   * Name of the application.
   */
  readonly name: string;

  /**
   * Description of the application.
   */
  readonly description: string;

  /**
   * Version of the application.
   */
  readonly version: string;

  // /**
  //  * Readable to use for stdin.
  //  */
  // readonly stdin: ReadableStream;
  //
  // /**
  //  * Writable to use for stdout.
  //  */
  // readonly stdout: WritableStream;
  //
  // /**
  //  * Writable to use for stderr.
  //  */
  // readonly stderr: WritableStream;

  /**
   * Get registered default argument values (if any) for a given {@link SubCommand}.
   *
   * @param subCommandName the name of the desired {@link SubCommand}.
   */
  getDefaultArgumentValuesForSubCommand(
    subCommandName: string,
  ): ArgumentValues | undefined;

  /**
   * Get registered default single argument value (if any) for a given {@link GlobalCommand} or by extension a {@link GlobalModifierCommand}.
   *
   * @param globalCommandName the name of the desired {@link GlobalCommand} or {@link GlobalModifierCommand}.
   */
  getDefaultArgumentValueForGlobalCommand(
    globalCommandName: string,
  ): ArgumentSingleValueType | undefined;
}
