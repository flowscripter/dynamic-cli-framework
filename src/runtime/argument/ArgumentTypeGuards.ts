import type Argument from "../../api/argument/Argument.ts";
import type ComplexOption from "../../api/argument/ComplexOption.ts";

export function isComplexOption(
  argument: Argument | ComplexOption,
): argument is ComplexOption {
  return (argument as ComplexOption).properties !== undefined;
}
