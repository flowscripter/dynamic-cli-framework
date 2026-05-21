import type ArgumentPrompterService from "../../api/service/core/ArgumentPrompterService.ts";
import type { ParseResult } from "../../runtime/parser.ts";
import type PrompterService from "../../api/service/core/PrompterService.ts";
import {
  type Prompt,
  type PromptOption,
  PromptType,
} from "../../api/service/core/PrompterService.ts";
import { InvalidArgumentReason } from "../../api/RunResult.ts";
import type { InvalidArgument } from "../../api/RunResult.ts";
import {
  type ArgumentSingleValueType,
  ArgumentValueTypeName,
  ComplexValueTypeName,
  type PopulatedArgumentSingleValueType,
  type PopulatedArgumentValues,
} from "../../api/argument/ArgumentValueTypes.ts";
import type Argument from "../../api/argument/Argument.ts";
import type Option from "../../api/argument/Option.ts";
import type Positional from "../../api/argument/Positional.ts";
import type ComplexOption from "../../api/argument/ComplexOption.ts";
import type SubCommand from "../../api/command/SubCommand.ts";
import type GlobalCommand from "../../api/command/GlobalCommand.ts";
import {
  isGlobalCommand,
  isSubCommand,
} from "../../runtime/command/CommandTypeGuards.ts";

export default class DefaultArgumentPrompterService
  implements ArgumentPrompterService {
  readonly #prompterService: PrompterService;

  public constructor(prompterService: PrompterService) {
    this.#prompterService = prompterService;
  }

  async promptForMissingArguments(
    parseResult: ParseResult,
  ): Promise<ParseResult> {
    if (!this.#prompterService.promptEnabled) {
      return parseResult;
    }

    const allMissingValue = parseResult.invalidArguments.every(
      (ia) => ia.reason === InvalidArgumentReason.MISSING_VALUE,
    );
    if (!allMissingValue) {
      return parseResult;
    }

    if (parseResult.invalidArguments.length === 0) {
      return parseResult;
    }

    try {
      if (isGlobalCommand(parseResult.command)) {
        return await this.#promptForGlobalCommand(parseResult);
      }
      if (isSubCommand(parseResult.command)) {
        return await this.#promptForSubCommand(parseResult);
      }
    } catch {
      return parseResult;
    }

    return parseResult;
  }

  async #promptForGlobalCommand(
    parseResult: ParseResult,
  ): Promise<ParseResult> {
    const command = parseResult.command as GlobalCommand;
    if (!command.argument) {
      return parseResult;
    }

    const prompt = DefaultArgumentPrompterService.#argumentToPrompt(
      command.name,
      command.name,
      command.argument,
    );
    const result = await this.#prompterService.prompt(prompt);
    const value = DefaultArgumentPrompterService.#coerceValue(
      result.value as ArgumentSingleValueType,
      command.argument.type,
    );

    return {
      command: parseResult.command,
      groupCommand: parseResult.groupCommand,
      populatedArgumentValues: value as PopulatedArgumentSingleValueType,
      invalidArguments: [],
      unusedArgs: parseResult.unusedArgs,
    };
  }

  async #promptForSubCommand(
    parseResult: ParseResult,
  ): Promise<ParseResult> {
    const command = parseResult.command as SubCommand;
    const existingValues = (parseResult.populatedArgumentValues ??
      {}) as PopulatedArgumentValues;
    const newValues: Record<
      string,
      PopulatedArgumentValues[string]
    > = { ...existingValues };
    const remainingInvalid: InvalidArgument[] = [];

    for (const invalid of parseResult.invalidArguments) {
      if (
        invalid.reason !== InvalidArgumentReason.MISSING_VALUE ||
        !invalid.name
      ) {
        remainingInvalid.push(invalid);
        continue;
      }

      const arg = DefaultArgumentPrompterService.#findArgument(
        command,
        invalid.name,
      );
      if (!arg) {
        remainingInvalid.push(invalid);
        continue;
      }

      if (
        "type" in arg &&
        (arg as ComplexOption).type === ComplexValueTypeName.COMPLEX
      ) {
        const complexValues = await this.#promptForComplexOption(
          invalid.name,
          arg as ComplexOption,
        );
        newValues[invalid.name] = complexValues;
      } else if (
        DefaultArgumentPrompterService.#isArrayArgument(arg)
      ) {
        const arrayValues = await this.#promptForArrayArgument(
          invalid.name,
          arg as Option | Positional,
        );
        newValues[invalid.name] = arrayValues;
      } else {
        const prompt = DefaultArgumentPrompterService.#argumentToPrompt(
          invalid.name,
          (arg as Option | Positional).description ?? invalid.name,
          arg as Argument,
        );
        const result = await this.#prompterService.prompt(prompt);
        newValues[invalid.name] = DefaultArgumentPrompterService.#coerceValue(
          result.value as ArgumentSingleValueType,
          (arg as Argument).type,
        );
      }
    }

    return {
      command: parseResult.command,
      groupCommand: parseResult.groupCommand,
      populatedArgumentValues: newValues as PopulatedArgumentValues,
      invalidArguments: remainingInvalid,
      unusedArgs: parseResult.unusedArgs,
    };
  }

  async #promptForComplexOption(
    name: string,
    complexOption: ComplexOption,
  ): Promise<PopulatedArgumentValues> {
    const values: Record<string, PopulatedArgumentValues[string]> = {};

    for (const prop of complexOption.properties) {
      if (
        "type" in prop &&
        (prop as ComplexOption).type === ComplexValueTypeName.COMPLEX
      ) {
        values[(prop as ComplexOption).name] = await this
          .#promptForComplexOption(
            `${name}.${(prop as ComplexOption).name}`,
            prop as ComplexOption,
          );
      } else {
        const option = prop as Option;
        if (option.isOptional && option.defaultValue !== undefined) {
          continue;
        }
        const prompt = DefaultArgumentPrompterService.#argumentToPrompt(
          `${name}.${option.name}`,
          option.description ?? `${name}.${option.name}`,
          option,
        );
        const result = await this.#prompterService.prompt(prompt);
        values[option.name] = DefaultArgumentPrompterService.#coerceValue(
          result.value as ArgumentSingleValueType,
          option.type,
        );
      }
    }

    return values as PopulatedArgumentValues;
  }

  async #promptForArrayArgument(
    name: string,
    arg: Option | Positional,
  ): Promise<Array<ArgumentSingleValueType>> {
    const values: ArgumentSingleValueType[] = [];

    while (true) {
      const prompt = DefaultArgumentPrompterService.#argumentToPrompt(
        name,
        `${arg.description ?? name}${
          values.length > 0 ? ` [${values.length + 1}]` : ""
        }`,
        arg as Argument,
      );
      const result = await this.#prompterService.prompt(prompt);
      values.push(
        DefaultArgumentPrompterService.#coerceValue(
          result.value as ArgumentSingleValueType,
          (arg as Argument).type,
        ),
      );

      const addAnother: Prompt = {
        name: `${name}_more`,
        promptText: `Add another value for ${name}?`,
        type: PromptType.ACKNOWLEDGE,
        options: [],
      };
      const moreResult = await this.#prompterService.prompt(addAnother);
      if (moreResult.value !== true) {
        break;
      }
    }

    return values;
  }

  static #argumentToPrompt(
    name: string,
    description: string,
    arg: Argument,
  ): Prompt {
    if (arg.type === ArgumentValueTypeName.BOOLEAN) {
      return {
        name,
        promptText: description,
        type: PromptType.TOGGLE,
        options: [],
      };
    }

    if (arg.allowableValues && arg.allowableValues.length > 0) {
      const options: PromptOption[] = arg.allowableValues.map((v) => ({
        displayValue: String(v),
        returnedValue: v,
      }));
      return {
        name,
        promptText: description,
        type: PromptType.SINGLE_SELECT,
        options,
      };
    }

    const validationOption: PromptOption = {
      displayValue: arg.type === ArgumentValueTypeName.SECRET
        ? "__SECRET__"
        : name,
      returnedValue: "",
      min: arg.minValueInclusive,
      max: arg.maxValueInclusive,
      validate: arg.validate ? (v) => arg.validate!(v) : undefined,
    };

    return {
      name,
      promptText: description,
      type: PromptType.TEXT,
      options: [validationOption],
    };
  }

  static #coerceValue(
    value: ArgumentSingleValueType,
    type: ArgumentValueTypeName,
  ): ArgumentSingleValueType {
    if (typeof value === "string") {
      switch (type) {
        case ArgumentValueTypeName.INTEGER:
          return parseInt(value, 10);
        case ArgumentValueTypeName.NUMBER:
          return parseFloat(value);
        case ArgumentValueTypeName.BOOLEAN:
          return value.toLowerCase() === "true";
      }
    }
    return value;
  }

  static #findArgument(
    command: SubCommand,
    name: string,
  ): Option | Positional | ComplexOption | undefined {
    for (const opt of command.options) {
      if (opt.name === name) return opt;
    }
    for (const pos of command.positionals) {
      if (pos.name === name) return pos;
    }
    return undefined;
  }

  static #isArrayArgument(
    arg: Option | Positional | ComplexOption,
  ): boolean {
    if ("isArray" in arg && (arg as Option).isArray) {
      return true;
    }
    if ("isVarargMultiple" in arg && (arg as Positional).isVarargMultiple) {
      return true;
    }
    return false;
  }
}
