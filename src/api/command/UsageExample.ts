/**
 * A usage example for a {@link SubCommand} to be used in help output.
 */
export default interface UsageExample {
  /**
   * The example arguments used to generate an example invocation.
   *
   * This should not include the CLI or command name.
   */
  readonly exampleArguments: string;

  /**
   * Optional description of the command example.
   */
  readonly description?: string;

  /**
   * Optional output result of executing the example command.
   */
  readonly output?: ReadonlyArray<string>;
}
