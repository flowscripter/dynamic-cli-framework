import {
  PRINTER_SERVICE_ID,
  ValueTypeName,
  type Context,
  type Option,
  type ComplexOption,
  type Positional,
  type PrinterService,
  type SubCommand,
  type Values,
} from "@flowscripter/dynamic-cli-framework-api";
import type ConfigurationServiceProvider from "../ConfigurationServiceProvider.ts";
import { isComplexOption } from "../../../runtime/argument/ArgumentTypeGuards.ts";
import {
  isOverriddenByEnvVar,
  maskDefault,
  type ConfigTarget,
  type PathStep,
} from "../configTargets.ts";

function typeName(option: { type: unknown; isArray?: boolean }): string {
  const name = isComplexOptionLike(option) ? "COMPLEX" : ValueTypeName[option.type as number];
  return option.isArray === true ? `${name}[]` : name!;
}

function isComplexOptionLike(option: { type: unknown }): boolean {
  return option.type === 5;
}

function constraints(option: Option): string {
  const parts: Array<string> = [];
  if (option.allowableValues !== undefined) {
    parts.push(`one of: ${option.allowableValues.join(", ")}`);
  }
  if (option.minValueInclusive !== undefined || option.maxValueInclusive !== undefined) {
    parts.push(`range: ${option.minValueInclusive ?? ""}..${option.maxValueInclusive ?? ""}`);
  }
  return parts.length === 0 ? "" : ` (${parts.join("; ")})`;
}

function mismatch(option: Option | ComplexOption, value: unknown): boolean {
  if (value === undefined || isComplexOption(option) || option.isArray === true) {
    return false;
  }
  switch (option.type) {
    case ValueTypeName.BOOLEAN:
      return typeof value !== "boolean";
    case ValueTypeName.INTEGER:
      return !Number.isInteger(value);
    case ValueTypeName.NUMBER:
      return typeof value !== "number";
    default:
      return typeof value !== "string";
  }
}

/**
 * Member of the `config` group which shows the configurable commands, their options and the
 * values currently stored for them. SECRET values are masked.
 */
export default class ConfigGetSubCommand implements SubCommand {
  readonly name = "get";
  readonly description = "Show configurable commands, their options and stored default values";
  readonly options: ReadonlyArray<Option> = [
    {
      name: "command",
      type: ValueTypeName.STRING,
      description: "Show only this command (or <group>:<member>)",
      isOptional: true,
      validate: (value) => {
        const targets = this.#provider.getConfigTargets();
        return targets.has(value as string)
          ? undefined
          : `unknown or non-configurable command, valid commands: ${[...targets.keys()].join(", ")}`;
      },
    },
  ];
  readonly positionals: ReadonlyArray<Positional> = [];

  readonly #provider: ConfigurationServiceProvider;

  public constructor(provider: ConfigurationServiceProvider) {
    this.#provider = provider;
  }

  public async execute(context: Context, argumentValues: Values): Promise<void> {
    const printer = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const targets = this.#provider.getConfigTargets();
    const selected = argumentValues["command"] as string | undefined;
    const keys = selected === undefined ? [...targets.keys()] : [selected];
    if (selected === undefined) {
      for (const key of this.#provider.defaultsData.keys()) {
        if (!targets.has(key)) {
          keys.push(key);
        }
      }
    }

    const lines: Array<string> = [];
    for (const key of keys) {
      const target = targets.get(key);
      const stored = this.#provider.defaultsData.get(key);
      if (target === undefined) {
        lines.push(`${key}  (unknown command, not configurable)`);
        lines.push(`  ${JSON.stringify(maskDefault(undefined, stored))}`);
        continue;
      }
      lines.push(key);
      if (target.argument !== undefined) {
        lines.push(
          `  ${typeName(target.argument)}${constraints(target.argument as Option)} = ${this.#show(context, target, [], stored)}`,
        );
        continue;
      }
      const values = (stored ?? {}) as Record<string, unknown>;
      this.#listOptions(context, target, target.options, [], "", values, lines);
      for (const name of Object.keys(values)) {
        if (!target.options.some((o) => o.name === name)) {
          lines.push(
            `  ${name}  (unknown option) = ${JSON.stringify(maskDefault(undefined, values[name]))}`,
          );
        }
      }
    }
    await printer.print(`${lines.join("\n")}\n`);
  }

  #show(
    context: Context,
    target: ConfigTarget,
    steps: ReadonlyArray<PathStep>,
    value: unknown,
  ): string {
    if (value === undefined) {
      return isOverriddenByEnvVar(this.#provider, context.cliConfig, target, steps)
        ? "(not set; overridden by an environment variable)"
        : "(not set)";
    }
    const text = JSON.stringify(maskDefault(target, value));
    return isOverriddenByEnvVar(this.#provider, context.cliConfig, target, steps)
      ? `${text} (overridden by an environment variable)`
      : text;
  }

  #listOptions(
    context: Context,
    target: ConfigTarget,
    options: ReadonlyArray<Option | ComplexOption>,
    steps: ReadonlyArray<PathStep>,
    prefix: string,
    values: Record<string, unknown> | undefined,
    lines: Array<string>,
  ): void {
    for (const option of options) {
      const path = `${prefix}${option.name}`;
      const optionSteps = [...steps, { name: option.name }];
      const value = values?.[option.name];
      const flag = mismatch(option, value) ? " (type mismatch)" : "";
      const indent = "  ".repeat(optionSteps.length);
      const optional =
        option.isOptional === true || option.defaultValue !== undefined ? "" : " required";
      const detail = isComplexOption(option) ? "" : constraints(option);
      const shown =
        value === undefined
          ? this.#show(context, target, optionSteps, undefined)
          : this.#showValue(context, target, optionSteps, option, value);
      lines.push(`${indent}${path}  ${typeName(option)}${optional}${detail} = ${shown}${flag}`);
      if (isComplexOption(option) && option.isArray !== true) {
        this.#listOptions(
          context,
          target,
          option.properties,
          optionSteps,
          `${path}.`,
          typeof value === "object" && value !== null
            ? (value as Record<string, unknown>)
            : undefined,
          lines,
        );
      }
    }
  }

  #showValue(
    context: Context,
    target: ConfigTarget,
    steps: ReadonlyArray<PathStep>,
    option: Option | ComplexOption,
    value: unknown,
  ): string {
    const wrapper: ConfigTarget = { ...target, argument: undefined, options: [option] };
    const masked = maskDefault(wrapper, { [option.name]: value }) as Record<string, unknown>;
    const text = JSON.stringify(masked[option.name]);
    return isOverriddenByEnvVar(this.#provider, context.cliConfig, target, steps)
      ? `${text} (overridden by an environment variable)`
      : text;
  }
}
