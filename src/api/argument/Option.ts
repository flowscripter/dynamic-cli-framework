import type { ArgumentValueType } from "./ArgumentValueTypes.ts";
import type SubCommandArgument from "./SubCommandArgument.ts";

/**
 * Interface for {@link SubCommand} option arguments.
 */
export default interface Option extends SubCommandArgument {
  /**
   * Optional short alias for the option.
   *
   * Must consist of a single alphanumeric non-whitespace ASCII character.
   */
  readonly shortAlias?: string;

  /**
   * Default value for the argument if not specified.
   */
  readonly defaultValue?: ArgumentValueType;

  /**
   * If this is `true` the option does not need to be specified nor have a default value.
   */
  readonly isOptional?: boolean;

  /**
   * If this is `true` the option can be specified multiple times and all values will be returned in an array
   * matching the order provided.
   *
   * NOTE: If {@link isOptional} is `false`, at least one instance of the option must be specified.
   */
  readonly isArray?: boolean;
}
