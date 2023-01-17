import {
  ArgumentSingleValueType,
  ArgumentValues,
  PopulatedArgumentValues,
  PopulatedArgumentValueType,
} from "../api/argument/ArgumentValueTypes.ts";
import CommandRegistry from "./registry/CommandRegistry.ts";
import Command from "../api/command/Command.ts";
import GroupCommand from "../api/command/GroupCommand.ts";
import GlobalModifierCommand from "../api/command/GlobalModifierCommand.ts";
import GlobalCommand from "../api/command/GlobalCommand.ts";
import SubCommand from "../api/command/SubCommand.ts";
import Argument from "../api/argument/Argument.ts";
import ComplexOption from "../api/argument/ComplexOption.ts";
// TODO: 12: move out of API

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
