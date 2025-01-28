import type GroupCommand from "../../src/api/command/GroupCommand.ts";
import type GlobalCommand from "../../src/api/command/GlobalCommand.ts";
import type SubCommand from "../../src/api/command/SubCommand.ts";
import {
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "../../src/api/argument/ArgumentValueTypes.ts";
import type ComplexOption from "../../src/api/argument/ComplexOption.ts";
import type Positional from "../../src/api/argument/Positional.ts";
import type GlobalCommandArgument from "../../src/api/argument/GlobalCommandArgument.ts";
import type GlobalModifierCommand from "../../src/api/command/GlobalModifierCommand.ts";
import type Option from "../../src/api/argument/Option.ts";

export function getGroupCommand(
  name = "groupCommand",
  memberSubCommands = [getSubCommandWithOption("foo")],
): GroupCommand {
  return {
    name,
    memberSubCommands,
    execute: async (): Promise<void> => {},
  };
}

export function getGlobalModifierCommand(
  name = "globalModifierCommand",
  shortAlias: string | undefined = undefined,
  withArg = false,
  mandatoryArg = false,
): GlobalModifierCommand {
  return {
    name,
    shortAlias,
    executePriority: 1,
    argument: withArg
      ? {
        type: ArgumentValueTypeName.STRING,
        isOptional: !mandatoryArg,
      }
      : undefined,
    execute: async (): Promise<void> => {},
  };
}

export function getGlobalModifierCommandWithArgument(
  name: string,
  shortAlias: string,
  executePriority = 1,
  argument?: GlobalCommandArgument,
  enableConfiguration = false,
): GlobalModifierCommand {
  return {
    name,
    enableConfiguration,
    shortAlias,
    executePriority,
    argument,
    execute: async (): Promise<void> => {},
  };
}

export function getGlobalCommand(
  name = "globalCommand",
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
        type: ArgumentValueTypeName.STRING,
        isOptional: !mandatoryArg,
        configurationKey,
      }
      : undefined,
    execute: async (): Promise<void> => {},
  };
}

export function getGlobalCommandWithShortAlias(
  name: string,
  shortAlias: string,
  argument?: GlobalCommandArgument,
): GlobalCommand {
  return {
    name,
    shortAlias,
    argument,
    execute: async (): Promise<void> => {},
  };
}

export function getSubCommandWithOptionAndPositional(): SubCommand {
  return {
    name: "subCommand",
    options: [{
      name: "goo",
      shortAlias: "g",
      type: ArgumentValueTypeName.STRING,
    }],
    positionals: [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }],
    execute: async (): Promise<void> => {},
  };
}

export function getSubCommand(
  name: string,
  options: Array<Option | ComplexOption>,
  positionals: Array<Positional> = [],
  enableConfiguration = false,
): SubCommand {
  return {
    name,
    options,
    positionals,
    enableConfiguration,
    execute: async (): Promise<void> => {},
  };
}

export function getSubCommandWithOption(
  name = "subCommand",
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

export function getSubCommandWithPositional(
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

export function getSubCommandWithComplexOptions(
  enableConfiguration = false,
  betaIsArray = false,
  deltaIsArray = false,
): SubCommand {
  return {
    name: "subCommand",
    enableConfiguration,
    options: [{
      name: "alpha",
      shortAlias: "a",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
      properties: [{
        name: "beta",
        shortAlias: "b",
        type: ComplexValueTypeName.COMPLEX,
        isArray: betaIsArray,
        properties: [{
          name: "gamma",
          shortAlias: "g",
          type: ArgumentValueTypeName.STRING,
        }, {
          name: "delta",
          shortAlias: "d",
          type: ArgumentValueTypeName.NUMBER,
          isArray: true,
        }],
      }],
    }, {
      name: "epsilon",
      shortAlias: "e",
      type: ComplexValueTypeName.COMPLEX,
      properties: [{
        name: "gamma",
        shortAlias: "g",
        type: ArgumentValueTypeName.STRING,
        configurationKey: "FOO_BAR_A",
      }, {
        name: "delta",
        shortAlias: "d",
        type: ArgumentValueTypeName.NUMBER,
        configurationKey: "FOO_BAR_B",
        isArray: deltaIsArray,
      }],
    }],
    positionals: [],
    execute: async (): Promise<void> => {},
  };
}
