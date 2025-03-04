import type Argument from "./Argument.ts";
import type { ArgumentSingleValueType } from "./ArgumentValueTypes.ts";

/**
 * Interface to be implemented by a single {@link Argument} defined by a {@link GlobalCommand}.
 */
export default interface GlobalCommandArgument extends Argument {
  /**
   * Default value for the argument if not specified.
   */
  readonly defaultValue?: ArgumentSingleValueType;

  /**
   * If this is `true` the argument does not need to be specified nor have a default value. The default is `false`.
   */
  readonly isOptional?: boolean;
}
