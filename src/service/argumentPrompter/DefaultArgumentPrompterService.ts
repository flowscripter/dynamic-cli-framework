import type { ArgumentPrompterService } from "@flowscripter/dynamic-cli-framework-api";
import type { ParseResult } from "../../runtime/parser.ts";
import type { PrompterService } from "@flowscripter/dynamic-cli-framework-api";
import {
  type Prompt,
  type PromptOption,
  PromptType,
} from "@flowscripter/dynamic-cli-framework-api";
import { InvalidArgumentReason } from "@flowscripter/dynamic-cli-framework-api";
import type { InvalidArgument } from "@flowscripter/dynamic-cli-framework-api";
import {
  type SingleValueType,
  ValueTypeName,
  ComplexValueTypeName,
  type PopulatedSingleValueType,
  type PopulatedValues,
} from "@flowscripter/dynamic-cli-framework-api";
import type { Argument } from "@flowscripter/dynamic-cli-framework-api";
import type { Option } from "@flowscripter/dynamic-cli-framework-api";
import type { Positional } from "@flowscripter/dynamic-cli-framework-api";
import type { ComplexOption } from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommand } from "@flowscripter/dynamic-cli-framework-api";
import { isGlobalCommand, isSubCommand } from "../../runtime/command/CommandTypeGuards.ts";

export default class DefaultArgumentPrompterService implements ArgumentPrompterService {
  readonly #prompterService: PrompterService;

  public constructor(prompterService: PrompterService) {
    this.#prompterService = prompterService;
  }

  async promptForMissingArguments(parseResult: ParseResult): Promise<ParseResult> {
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
    } catch (error) {
      if ((error as Error).message === "Interrupted") {
        throw error;
      }
      return parseResult;
    }

    return parseResult;
  }

  async #promptForGlobalCommand(parseResult: ParseResult): Promise<ParseResult> {
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
      result.value as SingleValueType,
      command.argument.type,
    );

    return {
      command: parseResult.command,
      groupCommand: parseResult.groupCommand,
      populatedArgumentValues: value as PopulatedSingleValueType,
      invalidArguments: [],
      unusedArgs: parseResult.unusedArgs,
    };
  }

  async #promptForSubCommand(parseResult: ParseResult): Promise<ParseResult> {
    const command = parseResult.command as SubCommand;
    const existingValues = (parseResult.populatedArgumentValues ?? {}) as PopulatedValues;
    const newValues: Record<string, PopulatedValues[string]> = {
      ...existingValues,
    };
    const remainingInvalid: InvalidArgument[] = [];

    for (const invalid of parseResult.invalidArguments) {
      if (invalid.reason !== InvalidArgumentReason.MISSING_VALUE || !invalid.name) {
        remainingInvalid.push(invalid);
        continue;
      }

      const arg = DefaultArgumentPrompterService.#findArgument(command, invalid.name);
      if (!arg) {
        remainingInvalid.push(invalid);
        continue;
      }

      if ("type" in arg && (arg as ComplexOption).type === ComplexValueTypeName.COMPLEX) {
        const complexValues = await this.#promptForComplexOption(
          invalid.name,
          arg as ComplexOption,
        );
        newValues[invalid.name] = complexValues;
      } else if (DefaultArgumentPrompterService.#isArrayArgument(arg)) {
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
          result.value as SingleValueType,
          (arg as Argument).type,
        );
      }
    }

    return {
      command: parseResult.command,
      groupCommand: parseResult.groupCommand,
      populatedArgumentValues: newValues as PopulatedValues,
      invalidArguments: remainingInvalid,
      unusedArgs: parseResult.unusedArgs,
    };
  }

  async #promptForComplexOption(
    name: string,
    complexOption: ComplexOption,
  ): Promise<PopulatedValues> {
    const values: Record<string, PopulatedValues[string]> = {};

    for (const prop of complexOption.properties) {
      if ("type" in prop && (prop as ComplexOption).type === ComplexValueTypeName.COMPLEX) {
        values[(prop as ComplexOption).name] = await this.#promptForComplexOption(
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
          result.value as SingleValueType,
          option.type,
        );
      }
    }

    return values as PopulatedValues;
  }

  async #promptForArrayArgument(
    name: string,
    arg: Option | Positional,
  ): Promise<Array<SingleValueType>> {
    const values: SingleValueType[] = [];

    while (true) {
      const prompt = DefaultArgumentPrompterService.#argumentToPrompt(
        name,
        `${arg.description ?? name}${values.length > 0 ? ` [${values.length + 1}]` : ""}`,
        arg as Argument,
      );
      const result = await this.#prompterService.prompt(prompt);
      values.push(
        DefaultArgumentPrompterService.#coerceValue(
          result.value as SingleValueType,
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

  static #argumentToPrompt(name: string, description: string, arg: Argument): Prompt {
    if (arg.type === ValueTypeName.BOOLEAN) {
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
      displayValue: arg.type === ValueTypeName.SECRET ? "__SECRET__" : name,
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

  static #coerceValue(value: SingleValueType, type: ValueTypeName): SingleValueType {
    if (typeof value === "string") {
      switch (type) {
        case ValueTypeName.INTEGER:
          return parseInt(value, 10);
        case ValueTypeName.NUMBER:
          return parseFloat(value);
        case ValueTypeName.BOOLEAN:
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

  static #isArrayArgument(arg: Option | Positional | ComplexOption): boolean {
    if ("isArray" in arg && (arg as Option).isArray) {
      return true;
    }
    if ("isVarargMultiple" in arg && (arg as Positional).isVarargMultiple) {
      return true;
    }
    return false;
  }
}
