import {
  ArgumentValueTypeName,
  GlobalCommand,
  GlobalModifierCommand,
  SubCommand,
} from "../../mod.ts";

export function getGlobalModifierCommand(
  name: string,
  withArg = false,
  mandatoryArg = false,
): GlobalModifierCommand {
  return {
    name,
    executePriority: 1,
    argument: withArg
      ? {
        name: "value",
        type: ArgumentValueTypeName.STRING,
        isOptional: !mandatoryArg,
      }
      : undefined,
    execute: async (): Promise<void> => {},
  };
}

export function getGlobalCommand(
  name: string,
  withArg = false,
  mandatoryArg = false,
  enableConfiguration = false,
  configurationKey?: string,
): GlobalCommand {
  return {
    name,
    enableConfiguration,
    argument: withArg
      ? {
        name: "value",
        type: ArgumentValueTypeName.STRING,
        isOptional: !mandatoryArg,
        configurationKey,
      }
      : undefined,
    execute: async (): Promise<void> => {},
  };
}

export function getSubCommand(
  name: string,
  withArg = false,
  mandatoryArg = false,
  multiple = false,
  type: ArgumentValueTypeName = ArgumentValueTypeName.STRING,
  defaultValue?: string,
  enableConfiguration = false,
  configurationKey?: string,
): SubCommand {
  return {
    name,
    description: "good",
    enableConfiguration,
    options: withArg
      ? [{
        name: "foo",
        type,
        isOptional: !mandatoryArg,
        isArray: multiple,
        defaultValue,
        configurationKey,
      }]
      : [],
    positionals: [],
    execute: async (): Promise<void> => {},
  };
}

export function getPositionalSubCommand(
  name: string,
  optional = false,
  multiple = false,
  type: ArgumentValueTypeName = ArgumentValueTypeName.STRING,
  enableConfiguration = false,
  configurationKey?: string,
): SubCommand {
  return {
    name,
    description: "good",
    enableConfiguration,
    options: [],
    positionals: [{
      name: "foo",
      type,
      isVarargOptional: optional,
      isVarargMultiple: multiple,
      configurationKey,
    }],
    execute: async (): Promise<void> => {},
  };
}
