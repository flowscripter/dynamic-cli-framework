import {
  ValueTypeName,
  type ComplexOption,
  type GlobalCommand,
  type Option,
  type PopulatedSingleValueType,
  type PopulatedValues,
  type PopulatedValueType,
  type SubCommand,
} from "@flowscripter/dynamic-cli-framework-api";
import { isComplexOption } from "../runtime/argument/ArgumentTypeGuards.ts";

export const REDACTED = "***";

type NamedArgument = { readonly name: string; readonly type?: unknown };

type RedactableValue =
  | PopulatedValueType
  | PopulatedValues
  | Array<PopulatedValues | undefined>
  | undefined;

function redactValue(
  definition: NamedArgument | ComplexOption,
  value: RedactableValue | PopulatedValues,
): unknown {
  if (value === undefined || value === null) {
    return value;
  }
  if (isComplexOption(definition as ComplexOption)) {
    const properties = (definition as ComplexOption).properties;
    if (Array.isArray(value)) {
      return value.map((v) => redactValue(definition, v));
    }
    return redactDefinedValues(properties, [], value as PopulatedValues);
  }
  if (definition.type === ValueTypeName.SECRET) {
    return Array.isArray(value) ? value.map(() => REDACTED) : REDACTED;
  }
  return value;
}

function redactDefinedValues(
  options: ReadonlyArray<Option | ComplexOption>,
  positionals: ReadonlyArray<NamedArgument>,
  values: PopulatedValues,
): PopulatedValues {
  const redacted: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(values)) {
    const definition =
      options.find((o) => o.name === name) ?? positionals.find((p) => p.name === name);
    redacted[name] = definition ? redactValue(definition, value) : value;
  }
  return redacted as PopulatedValues;
}

/**
 * Copy of the provided values suitable for logging, with the values of any SECRET options or positionals replaced.
 */
export function redactSubCommandValues<T extends PopulatedValues | undefined>(
  subCommand: SubCommand,
  values: T,
): T {
  if (values === undefined) {
    return values;
  }
  return redactDefinedValues(subCommand.options, subCommand.positionals, values) as T;
}

/**
 * Copy of the provided value suitable for logging, with the value replaced if the global command argument is a SECRET.
 */
export function redactGlobalCommandValue(
  globalCommand: GlobalCommand,
  value: PopulatedSingleValueType,
): PopulatedSingleValueType {
  if (value !== undefined && globalCommand.argument?.type === ValueTypeName.SECRET) {
    return REDACTED;
  }
  return value;
}
