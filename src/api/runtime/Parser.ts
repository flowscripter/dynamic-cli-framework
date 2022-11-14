import {
  ArgumentSingleValueType,
  ArgumentValues,
  PopulatedArgumentValues,
  PopulatedArgumentValueType,
} from "../argument/ArgumentValueTypes.ts";
import CommandRegistry from "../registry/CommandRegistry.ts";
import Command from "../command/Command.ts";
import GroupCommand from "../command/GroupCommand.ts";
import GlobalModifierCommand from "../command/GlobalModifierCommand.ts";
import GlobalCommand from "../command/GlobalCommand.ts";
import SubCommand from "../command/SubCommand.ts";
import Argument from "../argument/Argument.ts";
import ComplexOption from "../argument/ComplexOption.ts";

export const MAXIMUM_COMPLEX_OPTION_NESTING_DEPTH = 10;
export const MAXIMUM_ARGUMENT_ARRAY_SIZE = 255;

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
   * The value specified was not one of the valid values for the argument.
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
   * The name of the argument (if it was able to be populated)
   */
  readonly name?: string;

  /**
   * The {@link Argument} (if it was able to be populated)
   */
  readonly argument?: Argument | ComplexOption;

  /**
   * The argument value (if it was able to be populated). Note that this value is unlikely to be valid
   * as it is the cause of the invalid argument error.
   */
  readonly value?:
    | PopulatedArgumentValues
    | PopulatedArgumentValueType
    | Array<PopulatedArgumentValues | PopulatedArgumentValueType>;
}

/**
 * A container holding the result of a parser {@link CommandClause} parsing operation.
 */
export interface ParseResult {
  /**
   * The {@link Command} to execute (if {@link invalidArguments} is empty).
   */
  readonly command: Command;

  /**
   * Optional parent {@link GroupCommand} if the parsed {@link command} was a member {@link SubCommand},
   */
  readonly groupCommand?: GroupCommand;

  /**
   * The argument values populated from the command line args. If the parse result is valid, these
   * can be used to execute the specified {@link command}.
   */
  readonly populatedArgumentValues: PopulatedArgumentValues;

  /**
   * Any arguments which were invalid
   */
  readonly invalidArguments: ReadonlyArray<InvalidArgument>;

  /**
   * Any arguments which were unused in the parsing operation.
   */
  readonly unusedArgs: ReadonlyArray<string>;
}

/**
 * A single abstract result from scanning arguments for clauses.
 */
export interface CommandClause {
  /**
   * The potential arguments for the discovered {@link Command} ending before the next discovered {@link CommandClause}.
   */
  readonly potentialArgs: ReadonlyArray<string>;
}

/**
 * A {@link CommandClause} for a discovered {@link SubCommand} and its potential arguments.
 */
export interface SubCommandClause extends CommandClause {
  /**
   * The {@link SubCommand} referenced as an argument.
   */
  readonly command: SubCommand;

  /**
   * Optional parent {@link GroupCommand} if {@link command} is a member {@link SubCommand}.
   */
  readonly groupCommand?: GroupCommand;
}

/**
 * A {@link CommandClause} for a discovered {@link GlobalCommand} and its potential arguments.
 */
export interface GlobalCommandClause extends CommandClause {
  /**
   * The {@link GlobalCommand} referenced as an argument.
   */
  readonly command: GlobalCommand;
}

/**
 * A {@link CommandClause} for a discovered {@link GlobalModifierCommand} and its potential arguments.
 */
export interface GlobalModifierCommandClause extends GlobalCommandClause {
  /**
   * The {@link GlobalModifierCommand} referenced as an argument.
   */
  readonly command: GlobalModifierCommand;
}

/**
 * A container holding the result of a parser scanning operation.
 */
export interface ScanResult {
  /**
   * Optional clause containing {@link SubCommand} command parsed from the arguments.
   *
   * NOTE: At most one of {@link subCommandClause} and {@link globalCommandClause} will be populated.
   */
  readonly subCommandClause?: SubCommandClause;

  /**
   * Optional clause containing {@link GlobalCommand} command parsed from the arguments.
   *
   * NOTE: At most one of {@link subCommandClause} and {@link globalCommandClause} will be populated.
   */
  readonly globalCommandClause?: GlobalCommandClause;

  /**
   * Clauses containing {@link GlobalModifierCommand} commands parsed from the arguments.
   */
  readonly globalModifierCommandClauses: ReadonlyArray<
    GlobalModifierCommandClause
  >;

  /**
   * Any arguments which were unused in the scanning operation.
   *
   * As the scanning starts at the beginning of the provided arguments and a command clause is demarcated
   * by a matching {@link Command} (or {@link GlobalCommand} short aliases), this will
   * effectively be any leading arguments before the first {@link Command} was identified.
   */
  readonly unusedLeadingArgs: ReadonlyArray<string>;
}

/**
 * Parser interface consisting of a two stage interaction:
 *
 * * segment arguments into {@link CommandClause} instances
 *   based on registered {@link Command} names (or {@link GlobalCommand} short aliases).
 * * parse the arguments (and optional default values) for each identified {@link CommandClause}.
 */
export default interface Parser {
  /**
   * Scan the provided arguments and segment them into clauses demarcated by the {@link Command} instances
   * registered with the provided {@link CommandRegistry}
   *
   * @param args the arguments to scan.
   * @param commandRegistry contains the {@link Command} instances to use when parsing.
   */
  scanForCommandClauses(
    args: ReadonlyArray<string>,
    commandRegistry: CommandRegistry,
  ): ScanResult;

  /**
   * Parse the arguments for the specified {@link SubCommandClause}.
   *
   * @param subCommandClause the clause to parse.
   * @param configuredValues optional configured {@link ArgumentValues} to use for population before parsing the provided arguments.
   */
  parseSubCommandClause(
    subCommandClause: SubCommandClause,
    configuredValues?: ArgumentValues,
  ): ParseResult;

  /**
   * Parse the arguments for the specified {@link GlobalCommandClause} or {@link GlobalModifierCommandClause}.
   *
   * @param globalCommandClause the clause to parse.
   * @param configuredValue optional configured value to use for population before parsing the provided arguments.
   */
  parseGlobalCommandClause(
    globalCommandClause: GlobalCommandClause | GlobalModifierCommandClause,
    configuredValue?: ArgumentSingleValueType,
  ): ParseResult;
}
