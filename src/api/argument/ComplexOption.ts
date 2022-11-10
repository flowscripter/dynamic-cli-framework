import Option from "./Option.ts";
import { ComplexValueTypeName } from "./ArgumentValueTypes.ts";

/**
 * A container option argument for defining {@link SubCommand} nested argument hierarchies.
 */
export default interface ComplexOption extends Omit<Option, "type"> {
  /**
   * Type of the argument value.
   */
  readonly type: ComplexValueTypeName;

  /**
   * List of child {@link Option} properties.
   */
  readonly properties: ReadonlyArray<Option | ComplexOption>;
}
