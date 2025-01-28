import type SubCommandArgument from "./SubCommandArgument.ts";

/**
 * Interface for {@link SubCommand} positional arguments.
 */
export default interface Positional extends SubCommandArgument {
  /**
   * If this is `true` the argument can be specified one or multiple times and all values will be returned in
   * an array matching the order provided.
   *
   * NOTE: If {@link isVarargOptional} is `true`, the argument can specified zero, one or multiple times.
   *
   * NOTE: There can be only one positional with this set and it must be the last the last item if there
   * are multiple positionals defined.
   */
  readonly isVarargMultiple?: boolean;

  /**
   * If this is `true` the argument can be specified zero or once i.e. it does not need to be specified.
   *
   * NOTE: If {@link isVarargMultiple} is `true`, the argument can specified zero, one or multiple times.
   *
   * NOTE: There can be only one positional with this set and it must be the last the last item if there
   * are multiple positionals defined.
   */
  readonly isVarargOptional?: boolean;
}
