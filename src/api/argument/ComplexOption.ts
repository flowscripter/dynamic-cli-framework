import Option from "./Option.ts";
import { ArgumentValues, ComplexValueTypeName } from "./ArgumentValueTypes.ts";

/**
 * A container option argument for defining {@link SubCommand} nested argument hierarchies.
 */
export default interface ComplexOption extends
  Omit<
    Option,
    "type" | "defaultValue" | "allowableValues" | "configurationKey"
  > {
  /**
   * Type of the argument value.
   */
  readonly type: ComplexValueTypeName;

  /**
   * List of child {@link Option} properties.
   */
  readonly properties: ReadonlyArray<Option | ComplexOption>;

  /**
   * Default value for the argument if not specified.
   */
  readonly defaultValue?: ArgumentValues | Array<ArgumentValues>;
}
