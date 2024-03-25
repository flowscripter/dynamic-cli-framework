import Argument from "../../api/argument/Argument.ts";
import ComplexOption from "../../api/argument/ComplexOption.ts";

export function isComplexOption(
  argument: Argument | ComplexOption,
): argument is ComplexOption {
  return (argument as ComplexOption).properties !== undefined;
}
