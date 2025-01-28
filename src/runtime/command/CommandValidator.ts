import type Command from "../../api/command/Command.ts";
import { isGroupCommand, isSubCommand } from "./CommandTypeGuards.ts";
import type GlobalCommand from "../../api/command/GlobalCommand.ts";
import type Argument from "../../api/argument/Argument.ts";
import type GroupCommand from "../../api/command/GroupCommand.ts";
import type SubCommand from "../../api/command/SubCommand.ts";
import type {
  ArgumentSingleValueType,
} from "../../api/argument/ArgumentValueTypes.ts";
import {
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "../../api/argument/ArgumentValueTypes.ts";
import type Option from "../../api/argument/Option.ts";
import type ComplexOption from "../../api/argument/ComplexOption.ts";
import { isComplexOption } from "../argument/ArgumentTypeGuards.ts";
import {
  getInvalidArgumentString,
  validateGlobalCommandArgumentValue,
  validateOptionValue,
} from "../values/argumentValueValidation.ts";
import getLogger from "../../util/logger.ts";
import type CLIConfig from "../../api/CLIConfig.ts";
import {
  getGlobalCommandArgumentConfigurationKey,
  getSubCommandArgumentConfigurationKey,
} from "../../util/configHelper.ts";
import type { InvalidArgument } from "../../api/RunResult.ts";
import type SubCommandArgument from "../../api/argument/SubCommandArgument.ts";
import type GlobalCommandArgument from "../../api/argument/GlobalCommandArgument.ts";

const logger = getLogger("commandValidation");

function validateValueType(
  type: ArgumentValueTypeName,
  value: ArgumentSingleValueType,
  argumentName: string,
  isDefaultValue: boolean,
): void {
  switch (type) {
    case ArgumentValueTypeName.BOOLEAN:
      if (typeof value !== "boolean") {
        throw new Error(
          `Specified ${
            isDefaultValue ? "default" : "allowable"
          } value: '${value}' for argument: '${argumentName}' should be a boolean`,
        );
      }
      break;
    case ArgumentValueTypeName.NUMBER:
      if ((typeof value !== "number") || !Number.isFinite(value)) {
        throw new Error(
          `Specified ${
            isDefaultValue ? "default" : "allowable"
          } value: '${value}' for argument: '${argumentName}' should be a finite number`,
        );
      }
      break;
    case ArgumentValueTypeName.INTEGER:
      if ((typeof value !== "number") || !Number.isInteger(value)) {
        throw new Error(
          `Specified ${
            isDefaultValue ? "default" : "allowable"
          } value: '${value}' for argument: '${argumentName}' should be an integer`,
        );
      }
      break;
    case ArgumentValueTypeName.STRING:
      if (typeof value !== "string") {
        throw new Error(
          `Specified ${
            isDefaultValue ? "default" : "allowable"
          } value: '${value}' for argument: '${argumentName}' should be a string`,
        );
      }
      break;
  }
}

function isAlphaNumeric(value: string): boolean {
  return value.match(/^[a-z0-9]$/i) !== null;
}

function isAlphaNumericOrDashOrUnderscore(value: string): boolean {
  return value.match(/^[a-z0-9\-_]+$/i) !== null;
}

function isUppercaseAlphaNumericOrUnderscore(value: string): boolean {
  return value.match(/^[A-Z0-9_]+$/) !== null;
}

function isNameLegal(name: string): boolean {
  return (name.length > 0) && isAlphaNumericOrDashOrUnderscore(name) &&
    (name[0] !== "-");
}

function isConfigurationKeyLegal(configurationKey: string): boolean {
  return (configurationKey.length > 0) &&
    isUppercaseAlphaNumericOrUnderscore(configurationKey) &&
    !configurationKey[0].match(/[0-9]/);
}

function validateArgument(argument: Argument, name: string): void {
  if (
    (argument.type !== ArgumentValueTypeName.NUMBER) &&
    (argument.type !== ArgumentValueTypeName.INTEGER) &&
    (argument.type !== ArgumentValueTypeName.STRING) &&
    (argument.type !== ArgumentValueTypeName.BOOLEAN)
  ) {
    throw new Error(
      `Illegal type: '${argument.type}' for argument: '${name}'`,
    );
  }
  if (argument.allowableValues) {
    argument.allowableValues.forEach((value) => {
      validateValueType(argument.type, value, name, false);
    });
  }
}

function validateSubCommandArgument(
  subCommandArgument: SubCommandArgument,
): void {
  if (!isNameLegal(subCommandArgument.name)) {
    throw new Error(`Illegal argument name: '${subCommandArgument.name}'`);
  }
  return validateArgument(subCommandArgument, subCommandArgument.name);
}

export default class CommandValidator {
  readonly cliConfig: CLIConfig;
  readonly configurationKeys: Array<string> = [];

  public constructor(cliConfig: CLIConfig) {
    this.cliConfig = cliConfig;
  }

  /**
   * Validates the provided {@link Command}.
   *
   * @param command the {@link Command} to validate.
   *
   * @throws {Error} if the provided command does not pass validation.
   */
  public validate(command: Command): void {
    logger.debug("Validating command: %s", command.name);

    if (isSubCommand(command)) {
      this.#validateSubCommand(command);
    } else if (isGroupCommand(command)) {
      this.#validateGroupCommand(command);
    } else {
      this.#validateGlobalCommand(command as GlobalCommand);
    }
  }

  /**
   * Validates the provided {@link GlobalCommand} or by extension {@link GlobalModifierCommand}.
   *
   * @param globalCommand the {@link GlobalCommand} to validate.
   *
   * @throws {Error} if:
   * * the {@link Command.name} does not consist only of alphanumeric non-whitespace ASCII characters or `_` and `-`
   * characters.
   * * the {@link Command.name} starts with `-`.
   * * the {@link GlobalCommand.shortAlias} does not consist of a single alphanumeric non-whitespace ASCII character.
   * * the {@link GlobalCommand.argument} is defined and it is not valid.
   */
  #validateGlobalCommand(globalCommand: GlobalCommand): void {
    if (!isNameLegal(globalCommand.name)) {
      throw new Error(`Illegal global command name: '${globalCommand.name}'`);
    }
    if (
      globalCommand.shortAlias &&
      (globalCommand.shortAlias.length !== 1 ||
        !isAlphaNumeric(globalCommand.shortAlias))
    ) {
      throw new Error(
        `Illegal short alias: '${globalCommand.shortAlias}' for global command: '${globalCommand.name}'`,
      );
    }
    if (globalCommand.argument) {
      const { argument } = globalCommand;
      validateArgument(argument, globalCommand.name);
      if (argument.defaultValue) {
        const invalidArguments: Array<InvalidArgument> = [];
        validateGlobalCommandArgumentValue(
          globalCommand,
          argument.defaultValue,
          invalidArguments,
        );
        if (invalidArguments.length > 0) {
          throw new Error(
            `Illegal default value for global command: '${globalCommand.name}' => ${
              invalidArguments.map((invalidArgument) =>
                getInvalidArgumentString(invalidArgument, true)
              ).join(", ")
            }`,
          );
        }
      }
      this.#validateGlobalCommandArgumentConfigurationKey(
        globalCommand,
        argument,
      );
    }
  }

  /**
   * Validates the provided {@link GroupCommand}.
   *
   * @param groupCommand the {@link GroupCommand} to validate.
   *
   * @throws {Error} if:
   * * the {@link Command.name} does not consist only of alphanumeric non-whitespace ASCII characters or `_` and `-`
   * characters.
   * * the {@link Command.name} starts with `-`.
   * * {@link GroupCommand.memberSubCommands} is empty.
   * * any of the member {@link SubCommand} instances are themselves not valid.
   * * any of the member {@link SubCommand} instances define duplicate names.
   * * any of the member {@link SubCommand} instances define a name which duplicates the group command name.
   */
  #validateGroupCommand(groupCommand: GroupCommand): void {
    if (!isNameLegal(groupCommand.name)) {
      throw new Error(`Illegal group command name: '${groupCommand.name}'`);
    }
    if (groupCommand.memberSubCommands.length === 0) {
      throw new Error(
        `Group command: '${groupCommand.name}' has no member sub-commands`,
      );
    }
    const subCommandNames: Array<string> = [];
    groupCommand.memberSubCommands.forEach((subCommand) => {
      if (subCommandNames.includes(subCommand.name)) {
        throw new Error(
          `Group command: '${groupCommand.name}' contains member sub-commands with duplicate name: '${subCommand.name}'`,
        );
      }
      if (subCommand.name === groupCommand.name) {
        throw new Error(
          `Group command: '${groupCommand.name}' contains member sub-command with the same name`,
        );
      }
      subCommandNames.push(subCommand.name);
      this.#validateSubCommand(subCommand);
    });
  }

  /**
   * Validates the provided {@link SubCommand}.
   *
   * @param subCommand the {@link SubCommand} to validate.
   *
   * @throws {Error} if:
   * the {@link Command.name} does not consist only of alphanumeric non-whitespace ASCII characters or `_` and `-`
   characters.
   * the {@link Command.name} starts with `-`.
   * * any [[SubCommandArgument.name]] name does not consist only of alphanumeric non-whitespace ASCII characters
   * or `_` and `-` characters or starts with `-`.
   * * any entry in {@link SubCommand.options} is not valid.
   * * any entry in {@link SubCommand.positionals} is not valid.
   * * there are duplicate names in the {@link SubCommandArgument} instances defined by {@link SubCommand.options} and
   * {@link SubCommand.positionals}.
   * * there are duplicate property paths defined by {@link Argument.name} and {@link Option.shortAlias} entries in nested
   * {@link ComplexOption} instances.
   */
  #validateSubCommand(subCommand: SubCommand): void {
    if (!isNameLegal(subCommand.name)) {
      throw new Error(`Illegal sub-command name: '${subCommand.name}'`);
    }
    const argumentNames: Array<string> = [];
    const optionAliases: Array<string> = [];
    const allOptionPaths: Array<string> = [];
    if (subCommand.options) {
      subCommand.options.forEach((option) => {
        if (argumentNames.includes(option.name)) {
          throw new Error(
            `Sub-command: '${subCommand.name}' contains arguments with the same name: '${option.name}'`,
          );
        }
        argumentNames.push(option.name);
        const currentOptionPaths: Array<string> = [""];
        if (option.shortAlias) {
          if (argumentNames.includes(option.shortAlias)) {
            throw new Error(
              `Sub-command: '${subCommand.name}' contains arguments with the same name and short alias: '${option.shortAlias}'`,
            );
          }
          if (optionAliases.includes(option.shortAlias)) {
            throw new Error(
              `Sub-command: '${subCommand.name}' contains arguments with the same short alias: '${option.shortAlias}'`,
            );
          }
          optionAliases.push(option.shortAlias);
        }
        this.#validateOptionOrComplexOption(
          subCommand,
          option,
          currentOptionPaths,
          allOptionPaths,
          [],
        );
      });
    }
    if (subCommand.positionals) {
      for (let i = 0; i < subCommand.positionals.length; i += 1) {
        const positional = subCommand.positionals[i];
        validateSubCommandArgument(positional);
        if (argumentNames.includes(positional.name)) {
          throw new Error(
            `Sub-command: '${subCommand.name}' contains arguments with the same name: '${positional.name}'`,
          );
        }
        argumentNames.push(positional.name);

        if (
          (i < subCommand.positionals.length - 1) &&
          (positional.isVarargOptional || positional.isVarargMultiple)
        ) {
          throw new Error(
            `Positional: '${positional.name}' for the command: '${subCommand.name}' is defined as a vararg but it is not the last positional argument`,
          );
        }
        this.#validateSubCommandArgumentConfigurationKey(subCommand, [
          positional,
        ]);
      }
    }
  }

  #validateSubCommandArgumentConfigurationKey(
    command: Command,
    argumentAncestry: Array<SubCommandArgument>,
  ) {
    const argument = argumentAncestry[argumentAncestry.length - 1];
    if (command.enableConfiguration === true) {
      if (
        (argument.configurationKey !== undefined) &&
        !isConfigurationKeyLegal(argument.configurationKey)
      ) {
        throw new Error(
          `Illegal configuration key: '${argument.configurationKey}'`,
        );
      }
      const configurationKey = getSubCommandArgumentConfigurationKey(
        this.cliConfig,
        command,
        argumentAncestry,
      );

      if (configurationKey !== undefined) {
        if (this.configurationKeys.includes(configurationKey)) {
          throw new Error(
            `Command: '${command.name}' contains arguments with the same configuration key: '${configurationKey}'`,
          );
        }
        this.configurationKeys.push(configurationKey);
      }
    } else if (argument.configurationKey !== undefined) {
      throw new Error(
        `Command: '${command.name}' enableConfiguration is false, but an argument defines a configurationKey: '${argument.configurationKey}'`,
      );
    }
  }

  #validateGlobalCommandArgumentConfigurationKey(
    command: Command,
    globalCommandArgument: GlobalCommandArgument,
  ) {
    if (command.enableConfiguration === true) {
      if (
        (globalCommandArgument.configurationKey !== undefined) &&
        !isConfigurationKeyLegal(globalCommandArgument.configurationKey)
      ) {
        throw new Error(
          `Illegal configuration key: '${globalCommandArgument.configurationKey}'`,
        );
      }
      const configurationKey = getGlobalCommandArgumentConfigurationKey(
        this.cliConfig,
        command,
        globalCommandArgument,
      );

      if (configurationKey !== undefined) {
        if (this.configurationKeys.includes(configurationKey)) {
          throw new Error(
            `Command: '${command.name}' contains arguments with the same configuration key: '${configurationKey}'`,
          );
        }
        this.configurationKeys.push(configurationKey);
      }
    } else if (globalCommandArgument.configurationKey !== undefined) {
      throw new Error(
        `Command: '${command.name}' enableConfiguration is false, but an argument defines a configurationKey: '${globalCommandArgument.configurationKey}'`,
      );
    }
  }

  #validateOptionOrComplexOption(
    subCommand: SubCommand,
    option: Option | ComplexOption,
    currentOptionPaths: Array<string>,
    allOptionPaths: Array<string>,
    argumentAncestry: Array<SubCommandArgument>,
  ): void {
    if (
      option.shortAlias &&
      (option.shortAlias.length !== 1 || !isAlphaNumeric(option.shortAlias))
    ) {
      throw new Error(
        `Illegal short alias: '${option.shortAlias}' for option: '${option.name}'`,
      );
    }
    if (isComplexOption(option)) {
      this.#validateComplexOption(
        subCommand,
        option,
        currentOptionPaths,
        allOptionPaths,
        [...argumentAncestry, option as unknown as SubCommandArgument],
      );
    } else {
      this.#validateOption(option, currentOptionPaths, allOptionPaths);
      this.#validateSubCommandArgumentConfigurationKey(subCommand, [
        ...argumentAncestry,
        option,
      ]);
    }
  }

  #validateOption(
    option: Option,
    currentOptionPaths: Array<string>,
    allOptionPaths: Array<string>,
  ): void {
    validateSubCommandArgument(option);
    if (Array.isArray(option.defaultValue) && !option.isArray) {
      throw new Error(
        `Illegal array default value: '${
          option.defaultValue.join(",")
        }' for non-array option: '${option.name}'`,
      );
    }
    if (option.defaultValue) {
      const invalidArguments: Array<InvalidArgument> = [];
      validateOptionValue(
        option,
        option.defaultValue,
        invalidArguments,
      );
      if (invalidArguments.length > 0) {
        throw new Error(
          `Illegal default value for option: '${option.name}' => ${
            invalidArguments.map((invalidArgument) =>
              getInvalidArgumentString(invalidArgument, true)
            ).join(", ")
          }`,
        );
      }
    }
    currentOptionPaths.forEach((currentOptionPath) => {
      const leafPath = `${currentOptionPath}.${option.name}`;
      if (allOptionPaths.includes(leafPath)) {
        throw new Error(
          `Duplicate nested option path: '${leafPath}' discovered for option: '${option.name}'`,
        );
      }
      allOptionPaths.push(leafPath);
    });
    if (option.shortAlias) {
      currentOptionPaths.forEach((currentOptionPath) => {
        const leafPath = `${currentOptionPath}.${option.shortAlias}`;
        if (allOptionPaths.includes(leafPath)) {
          throw new Error(
            `Duplicate nested option path: '${leafPath}' discovered for option: '${option.name}'`,
          );
        }
        allOptionPaths.push(leafPath);
      });
    }
  }

  #validateComplexOption(
    subCommand: SubCommand,
    complexOption: ComplexOption,
    currentOptionPaths: Array<string>,
    allOptionPaths: Array<string>,
    argumentAncestry: Array<SubCommandArgument>,
  ): void {
    if (!isNameLegal(complexOption.name)) {
      throw new Error(`Illegal complex option name: '${complexOption.name}'`);
    }
    if (complexOption.type !== ComplexValueTypeName.COMPLEX) {
      throw new Error(
        `Illegal type: '${complexOption.type}' for complex option: '${complexOption.name}'`,
      );
    }
    if (Array.isArray(complexOption.defaultValue) && !complexOption.isArray) {
      throw new Error(
        `Illegal array default value: '${
          JSON.stringify(complexOption.defaultValue)
        }' for non-array option: '${complexOption.name}'`,
      );
    }
    if (complexOption.defaultValue) {
      const invalidArguments: Array<InvalidArgument> = [];
      validateOptionValue(
        complexOption,
        complexOption.defaultValue,
        invalidArguments,
      );
      if (invalidArguments.length > 0) {
        throw new Error(
          `Illegal default value for option: '${complexOption.name}' => ${
            invalidArguments.map((invalidArgument) =>
              getInvalidArgumentString(invalidArgument, true)
            ).join(", ")
          }`,
        );
      }
    }
    if (complexOption.properties.length === 0) {
      throw new Error(
        `Complex option: '${complexOption.name}' has no properties`,
      );
    }
    complexOption.properties.forEach((property) => {
      const newCurrentOptionPaths: Array<string> = [];
      currentOptionPaths.forEach((currentOptionPath) => {
        newCurrentOptionPaths.push(`${currentOptionPath}.${property.name}`);
      });
      if (property.shortAlias) {
        currentOptionPaths.forEach((currentOptionPath) => {
          newCurrentOptionPaths.push(
            `${currentOptionPath}.${property.shortAlias}`,
          );
        });
      }
      this.#validateOptionOrComplexOption(
        subCommand,
        property,
        newCurrentOptionPaths,
        allOptionPaths,
        [...argumentAncestry, complexOption as unknown as SubCommandArgument],
      );
    });
  }
}
