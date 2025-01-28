/**
 * State of a {@link CLI} after invocation.
 */
import type Command from "./command/Command.ts";
import type Argument from "./argument/Argument.ts";
import type ComplexOption from "./argument/ComplexOption.ts";
import type {
  PopulatedArgumentValues,
  PopulatedArgumentValueType,
} from "./argument/ArgumentValueTypes.ts";

export enum RunState {
  /**
   * Arguments were successfully parsed and the specified command(s) were successfully executed.
   */
  SUCCESS = 0,

  /**
   * The arguments supplied were invalid or could not be parsed.
   */
  PARSE_ERROR = 1,

  /**
   * Arguments were successfully parsed but no command was discovered.
   */
  NO_COMMAND = 2,

  /**
   * Arguments were successfully parsed and command(s) discovered but command execution failed.
   */
  EXECUTION_ERROR = 3,

  /**
   * General runtime error related to the framework.
   */
  RUNTIME_ERROR = 4,
}

/**
 * Possible reasons for an invalid argument.
 */
export enum InvalidArgumentReason {
  /**
   * The argument value was not specified.
   */
  MISSING_VALUE = 0,

  /**
   * The value specified was not the correct type for the argument.
   */
  INCORRECT_VALUE_TYPE = 1,

  /**
   * The argument does not support multiple values.
   */
  ILLEGAL_MULTIPLE_VALUES = 2,

  /**
   * The value specified was not one of the defined allowable values for the argument.
   */
  ILLEGAL_VALUE = 3,

  /**
   * The arguments specified resulted in a sparse array of values.
   */
  ILLEGAL_SPARSE_ARRAY = 4,

  /**
   * The argument specified an unknown complex option property.
   */
  UNKNOWN_PROPERTY = 5,

  /**
   * Complex option nesting exceeds maximum of {@link MAXIMUM_COMPLEX_OPTION_NESTING_DEPTH}.
   */
  NESTING_DEPTH_EXCEEDED = 6,

  /**
   * Array value nesting exceeds maximum of {@link MAXIMUM_ARGUMENT_ARRAY_SIZE}.
   */
  ARRAY_SIZE_EXCEEDED = 7,

  /**
   * Attempt to set a primitive value on a complex object object.
   */
  OPTION_IS_COMPLEX = 8,
}

/**
 * Details of an invalid parsed argument.
 */
export interface InvalidArgument {
  /**
   * A reason for the parsing error
   */
  readonly reason: InvalidArgumentReason;

  /**
   * The name of the argument specified (if it was able to be populated)
   */
  readonly name?: string;

  /**
   * The {@link Argument} (if it was able to be populated)
   */
  readonly argument?: Argument | ComplexOption;

  /**
   * The argument value (if it was able to be populated).
   *
   * NOTE: This value is unlikely to be valid as it is the cause of the invalid argument error.
   */
  readonly value?:
    | PopulatedArgumentValues
    | PopulatedArgumentValueType
    | Array<PopulatedArgumentValues | PopulatedArgumentValueType>;
}

/**
 * Result of a {@link CLI} invocation.
 */
export default interface RunResult {
  /**
   * The state after processing the invocation.
   */
  readonly runState: RunState;

  /**
   * Populated if {@link runState} is {@link RunState.SUCCESS}, {@link RunState.PARSE_ERROR} or {@link RunState.EXECUTION_ERROR}.
   */
  readonly command?: Command;

  /**
   * Populated if {@link runState} is {@link RunState.PARSE_ERROR}
   */
  readonly invalidArguments?: ReadonlyArray<InvalidArgument>;

  /**
   * Populated if {@link runState} is {@link RunState.EXECUTION_ERROR} or {@link RunState.RUNTIME_ERROR}.
   */
  readonly error?: Error;
}
