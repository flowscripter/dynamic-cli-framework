import {
  MAXIMUM_COMPLEX_OPTION_NESTING_DEPTH,
  SECRET_SENTINEL_PREFIX,
  ValueTypeName,
  type Command,
  type ComplexOption,
  type GlobalCommandArgument,
  type GroupCommand,
  type InvalidArgument,
  type Option,
  type CommandRegistry,
  type CLIConfig,
  type GlobalCommand,
  type SubCommand,
  type SingleValueType,
  type Values,
  type ValueNode,
} from "@flowscripter/dynamic-cli-framework-api";
import { isComplexOption } from "../../runtime/argument/ArgumentTypeGuards.ts";
import {
  getInvalidArgumentString,
  runCustomValidation,
  validateGlobalCommandArgumentValue,
  validateOptionValue,
  type DeferredCustomValidation,
} from "../../runtime/values/argumentValueValidation.ts";
import {
  getGlobalCommandValueFromEnvVars,
  getSubCommandValuesFromEnvVars,
} from "../../util/envVarHelper.ts";
import { isGlobalModifierCommand } from "../../runtime/command/CommandTypeGuards.ts";

export const MASK = "********";

type Node = unknown;

/**
 * A command whose default argument values can be managed via the `config` group commands.
 */
export interface ConfigTarget {
  /** The key under `defaults`: the command name or `<group name>:<member name>`. */
  readonly key: string;
  readonly command: Command;
  readonly group?: GroupCommand;
  /** Set for global commands and global modifier commands. */
  readonly argument?: GlobalCommandArgument;
  /** Empty for global commands. */
  readonly options: ReadonlyArray<Option | ComplexOption>;
}

/**
 * Collect all commands in the registry with `enableConfiguration` set, except the `config` modifier.
 */
export function getConfigTargets(registry: CommandRegistry): Map<string, ConfigTarget> {
  const targets = new Map<string, ConfigTarget>();
  const globals = [...registry.getGlobalCommands(), ...registry.getGlobalModifierCommands()];
  for (const command of globals) {
    if (command.enableConfiguration !== true || command.argument === undefined) {
      continue;
    }
    if (isGlobalModifierCommand(command) && command.name === "config") {
      continue;
    }
    targets.set(command.name, {
      key: command.name,
      command,
      argument: command.argument,
      options: [],
    });
  }
  for (const command of registry.getSubCommands()) {
    if (command.enableConfiguration === true) {
      targets.set(command.name, { key: command.name, command, options: command.options });
    }
  }
  for (const [key, { groupCommand, command }] of registry.getGroupAndMemberCommandsByJoinedName()) {
    if (command.enableConfiguration === true) {
      targets.set(key, { key, command, group: groupCommand, options: command.options });
    }
  }
  return targets;
}

export interface PathStep {
  readonly name: string;
  readonly index?: number;
}

/**
 * Parse an option path such as `address[1].port` into steps.
 */
export function parseOptionPath(path: string): Array<PathStep> | string {
  const elements = path.split(".");
  if (elements.length > MAXIMUM_COMPLEX_OPTION_NESTING_DEPTH) {
    return `option path '${path}' exceeds the maximum nesting depth`;
  }
  const steps: Array<PathStep> = [];
  for (const element of elements) {
    const match = /^([^[\]]+)(?:\[(\d+)\])?$/.exec(element);
    if (match === null) {
      return `invalid option path '${path}'`;
    }
    steps.push(
      match[2] === undefined ? { name: match[1]! } : { name: match[1]!, index: Number(match[2]) },
    );
  }
  return steps;
}

export interface ResolvedPath {
  readonly steps: Array<PathStep>;
  readonly leaf: Option | ComplexOption;
}

/**
 * Walk the steps through the target's options returning the option the path refers to.
 */
export function resolveOptionPath(target: ConfigTarget, path: string): ResolvedPath | string {
  const steps = parseOptionPath(path);
  if (typeof steps === "string") {
    return steps;
  }
  let candidates: ReadonlyArray<Option | ComplexOption> = target.options;
  let leaf: Option | ComplexOption | undefined;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    leaf = candidates.find((o) => o.name === step.name);
    if (leaf === undefined) {
      return `unknown option '${step.name}' in '${path}'`;
    }
    if (step.index !== undefined && leaf.isArray !== true) {
      return `option '${step.name}' is not an array`;
    }
    if (i < steps.length - 1) {
      if (!isComplexOption(leaf)) {
        return `option '${step.name}' has no properties`;
      }
      if (leaf.isArray === true && step.index === undefined) {
        return `option '${step.name}' is an array and requires an index`;
      }
      candidates = leaf.properties;
    }
  }
  return { steps, leaf: leaf! };
}

export function containsSecret(option: Option | ComplexOption): boolean {
  if (isComplexOption(option)) {
    return option.properties.some(containsSecret);
  }
  return option.type === ValueTypeName.SECRET;
}

function asOptional<T extends Option | ComplexOption>(option: T): T {
  if (isComplexOption(option)) {
    return {
      ...option,
      isOptional: true,
      properties: option.properties.map(asOptional),
    } as T;
  }
  return { ...option, isOptional: true } as T;
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

export function getAtPath(root: Node, steps: ReadonlyArray<PathStep>): Node {
  let current = root;
  for (const step of steps) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, Node>)[step.name];
    if (step.index !== undefined) {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[step.index];
    }
  }
  return current;
}

/**
 * Set a value at the path in the provided (mutable) root creating parents as needed.
 */
export function setAtPath(
  root: Record<string, Node>,
  steps: ReadonlyArray<PathStep>,
  value: Node,
): void {
  let container = root;
  steps.forEach((step, i) => {
    const isLast = i === steps.length - 1;
    if (step.index === undefined) {
      if (isLast) {
        container[step.name] = value;
        return;
      }
      if (typeof container[step.name] !== "object" || container[step.name] === null) {
        container[step.name] = {};
      }
      container = container[step.name] as Record<string, Node>;
      return;
    }
    if (!Array.isArray(container[step.name])) {
      container[step.name] = [];
    }
    const array = container[step.name] as Array<Node>;
    if (step.index > array.length) {
      throw new Error(
        `cannot set '${step.name}[${step.index}]': array has ${array.length} element(s) and sparse arrays are not supported`,
      );
    }
    if (isLast) {
      array[step.index] = value;
      return;
    }
    if (typeof array[step.index] !== "object" || array[step.index] === null) {
      array[step.index] = {};
    }
    container = array[step.index] as Record<string, Node>;
  });
}

/**
 * Remove the value at the path and any parent objects left empty. Returns false if there was no value.
 */
export function removeAtPath(root: Record<string, Node>, steps: ReadonlyArray<PathStep>): boolean {
  if (getAtPath(root, steps) === undefined) {
    return false;
  }
  const last = steps[steps.length - 1]!;
  if (last.index !== undefined) {
    throw new Error("unsetting an array element is not supported: unset the whole option instead");
  }
  const parents: Array<Record<string, Node>> = [root];
  let container = root;
  for (const step of steps.slice(0, -1)) {
    container =
      step.index === undefined
        ? (container[step.name] as Record<string, Node>)
        : ((container[step.name] as Array<Node>)[step.index] as Record<string, Node>);
    parents.push(container);
  }
  delete container[last.name];
  for (let i = steps.length - 2; i >= 0; i--) {
    const step = steps[i]!;
    if (step.index !== undefined || Object.keys(parents[i + 1]!).length > 0) {
      break;
    }
    delete parents[i]![step.name];
  }
  return true;
}

/**
 * All `__SECRET__:` sentinel strings within the value.
 */
export function collectSentinels(value: Node): Array<string> {
  if (typeof value === "string") {
    return value.startsWith(SECRET_SENTINEL_PREFIX) ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectSentinels);
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(collectSentinels);
  }
  return [];
}

function invalidMessage(invalid: Array<InvalidArgument>): string {
  return invalid.map((i) => getInvalidArgumentString(i, false) + (i.message ?? "")).join("; ");
}

/**
 * A validated, converted change to a single option of a target.
 */
export interface ConfigChange {
  readonly steps: ReadonlyArray<PathStep>;
  readonly path: string;
  readonly leaf: Option | ComplexOption;
  /** Native value, or the plain text of a SECRET which must be stored via the secret service. */
  readonly value: Node;
  readonly isSecret: boolean;
}

/**
 * Validate and convert the raw (string) value for the option path of the target. Required checks are
 * not applied. Custom validators of the target are run later by {@link validateChanges}.
 */
export function prepareChange(
  target: ConfigTarget,
  path: string,
  raw: string,
  deferred: Array<DeferredCustomValidation>,
): ConfigChange | string {
  const resolved = resolveOptionPath(target, path);
  if (typeof resolved === "string") {
    return resolved;
  }
  const { steps, leaf } = resolved;
  const hasIndex = steps[steps.length - 1]!.index !== undefined;
  const whole = isComplexOption(leaf) || (leaf.isArray === true && !hasIndex);
  const invalid: Array<InvalidArgument> = [];
  let value: Node;
  if (whole) {
    if (!/^\s*[[{]/.test(raw)) {
      return `option '${path}' requires a JSON ${leaf.isArray === true && !hasIndex ? "array" : "object"} value`;
    }
    if (containsSecret(leaf)) {
      return `option '${path}' contains SECRET values: set each secret property individually`;
    }
    try {
      value = JSON.parse(raw);
    } catch (err) {
      return `invalid JSON value for '${path}': ${(err as Error).message}`;
    }
    value = validateOptionValue(asOptional(leaf), value as never, invalid, deferred);
  } else {
    value = validateOptionValue(
      { ...asOptional(leaf), isArray: false } as Option,
      raw,
      invalid,
      deferred,
    );
  }
  if (invalid.length > 0) {
    return `${path}: ${invalidMessage(invalid)}`;
  }
  const isSecret = !isComplexOption(leaf) && leaf.type === ValueTypeName.SECRET;
  return { steps, path, leaf, value, isSecret };
}

/**
 * Validate a raw value for a global command argument.
 */
export function prepareGlobalValue(
  target: ConfigTarget,
  raw: string,
  deferred: Array<DeferredCustomValidation>,
): { value: SingleValueType; isSecret: boolean } | string {
  const invalid: Array<InvalidArgument> = [];
  const argument = { ...target.argument!, isOptional: true };
  const value = validateGlobalCommandArgumentValue(
    { ...target.command, argument } as never,
    raw,
    invalid,
    deferred,
  );
  if (invalid.length > 0 || value === undefined) {
    return invalidMessage(invalid);
  }
  return { value, isSecret: target.argument!.type === ValueTypeName.SECRET };
}

/**
 * Apply the changes to a copy of the existing values and run the custom validators of the target.
 * Returns the new values or an error message.
 */
export function applyChanges(
  target: ConfigTarget,
  existing: Values | undefined,
  changes: ReadonlyArray<ConfigChange>,
  deferred: Array<DeferredCustomValidation>,
): Values | string {
  const values = clone(existing ?? {}) as Record<string, Node>;
  try {
    for (const change of changes) {
      setAtPath(values, change.steps, change.value);
    }
  } catch (err) {
    return (err as Error).message;
  }
  const invalid: Array<InvalidArgument> = [];
  runCustomValidation(deferred, target.command, values as never, invalid);
  if (invalid.length > 0) {
    return invalidMessage(invalid);
  }
  return values as Values;
}

function maskSentinels(value: Node): Node {
  if (typeof value === "string") {
    return value.startsWith(SECRET_SENTINEL_PREFIX) ? MASK : value;
  }
  if (Array.isArray(value)) {
    return value.map(maskSentinels);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskSentinels(v)]));
  }
  return value;
}

function maskOption(option: Option | ComplexOption, value: Node): Node {
  if (value === undefined || value === null) {
    return value;
  }
  if (isComplexOption(option)) {
    if (Array.isArray(value)) {
      return value.map((v) => maskOption({ ...option, isArray: false }, v));
    }
    return maskOptions(option.properties, value);
  }
  if (option.type === ValueTypeName.SECRET) {
    return Array.isArray(value) ? value.map(() => MASK) : MASK;
  }
  return value;
}

function maskOptions(options: ReadonlyArray<Option | ComplexOption>, value: Node): Node {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([name, v]) => {
      const option = options.find((o) => o.name === name);
      return [name, option === undefined ? v : maskOption(option, v)];
    }),
  );
}

/**
 * Copy of a stored default value with SECRET typed values and any secret sentinels masked.
 */
export function maskDefault(target: ConfigTarget | undefined, value: Node): Node {
  let masked = value;
  if (target?.argument !== undefined) {
    if (target.argument.type === ValueTypeName.SECRET && value !== undefined) {
      masked = MASK;
    }
  } else if (target !== undefined) {
    masked = maskOptions(target.options, value);
  }
  return maskSentinels(masked);
}

export type { ValueNode };

/**
 * Whether an environment variable would override the stored value at the path.
 */
export function isOverriddenByEnvVar(
  provider: { readonly envVarsEnabled: boolean },
  cliConfig: CLIConfig,
  target: ConfigTarget,
  steps: ReadonlyArray<PathStep>,
): boolean {
  if (!provider.envVarsEnabled) {
    return false;
  }
  if (target.argument !== undefined) {
    return (
      getGlobalCommandValueFromEnvVars(cliConfig, target.command as GlobalCommand) !== undefined
    );
  }
  const values = getSubCommandValuesFromEnvVars(
    cliConfig,
    target.command as SubCommand,
    target.group,
  );
  return getAtPath(values, steps) !== undefined;
}
