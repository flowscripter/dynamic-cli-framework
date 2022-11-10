import Argument from "./Argument.ts";
import ComplexOption from "./ComplexOption.ts";

export function isComplexOption(
  argument: Argument | ComplexOption,
): argument is ComplexOption {
  return (argument as ComplexOption).properties !== undefined;
}
