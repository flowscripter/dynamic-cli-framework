import type {
  PopulatedArgumentSingleValueType,
  PopulatedArgumentValues,
} from "../../api/argument/ArgumentValueTypes.ts";
import type { InvalidArgument } from "../../api/RunResult.ts";

/**
 * A base interface for a container holding the result of argument value population.
 */
export interface ValuePopulationResult {
  /**
   * Any args which were unused during argument value population.
   */
  readonly unusedArgs: ReadonlyArray<string>;

  /**
   * Any invalid argument discovered while populating values.
   */
  readonly invalidArgument?: InvalidArgument;
}

/**
 * A container holding the result of argument values population for a {@link SubCommand}.
 */
export interface SubCommandValuePopulationResult extends ValuePopulationResult {
  /**
   * Populated argument values.
   */
  readonly populatedArgumentValues: PopulatedArgumentValues;
}

/**
 * A container holding the result of argument value population for a {@link GlobalCommand} or by extension a {@link GlobalModifierCommand}.
 */
export interface GlobalCommandValuePopulationResult
  extends ValuePopulationResult {
  /**
   * Populated argument value.
   */
  readonly populatedArgumentValue: PopulatedArgumentSingleValueType;
}
