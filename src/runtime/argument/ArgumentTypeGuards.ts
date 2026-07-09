import type { Argument } from "@flowscripter/dynamic-cli-framework-api";
import type { ComplexOption } from "@flowscripter/dynamic-cli-framework-api";

export function isComplexOption(argument: Argument | ComplexOption): argument is ComplexOption {
  return (argument as ComplexOption).properties !== undefined;
}
