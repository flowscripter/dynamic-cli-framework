import { describe, expect, test } from "bun:test";
import DefaultArgumentPrompterService from "../../../src/service/argumentPrompter/DefaultArgumentPrompterService.ts";
import type PrompterService from "../../../src/api/service/core/PrompterService.ts";
import type {
  Prompt,
  PromptResult,
} from "../../../src/api/service/core/PrompterService.ts";
import type { ParseResult } from "../../../src/runtime/parser.ts";
import { InvalidArgumentReason } from "../../../src/api/RunResult.ts";
import { ArgumentValueTypeName } from "../../../src/api/argument/ArgumentValueTypes.ts";
import type SubCommand from "../../../src/api/command/SubCommand.ts";
import type GlobalCommand from "../../../src/api/command/GlobalCommand.ts";

class MockPrompterService implements PrompterService {
  promptEnabled = true;
  #responses: Map<string, PromptResult> = new Map();

  addResponse(name: string, value: PromptResult["value"]) {
    this.#responses.set(name, { name, value });
  }

  prompt(promptDef: Prompt): Promise<PromptResult> {
    const result = this.#responses.get(promptDef.name);
    if (!result) {
      return Promise.reject(
        new Error(`No mock response for prompt: ${promptDef.name}`),
      );
    }
    return Promise.resolve(result);
  }

  async promptAll(
    prompts: ReadonlyArray<Prompt>,
  ): Promise<ReadonlyArray<PromptResult>> {
    const results: PromptResult[] = [];
    for (const p of prompts) {
      results.push(await this.prompt(p));
    }
    return results;
  }
}

function makeSubCommand(
  name: string,
  options: SubCommand["options"] = [],
  positionals: SubCommand["positionals"] = [],
): SubCommand {
  return {
    name,
    description: `${name} description`,
    options,
    positionals,
    enableConfiguration: false,
    execute: () => Promise.resolve(),
  } as SubCommand;
}

function _makeGlobalCommand(name: string): GlobalCommand {
  return {
    name,
    description: `${name} description`,
    argument: {
      type: ArgumentValueTypeName.STRING,
    },
  } as GlobalCommand;
}

describe("DefaultArgumentPrompterService tests", () => {
  test("promptEnabled=false returns original parseResult", async () => {
    const prompter = new MockPrompterService();
    prompter.promptEnabled = false;
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand("test", [
      {
        name: "foo",
        description: "foo option",
        type: ArgumentValueTypeName.STRING,
        isOptional: false,
      },
    ]);

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "foo",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result).toBe(parseResult);
  });

  test("non-MISSING_VALUE invalidArguments returns original parseResult", async () => {
    const prompter = new MockPrompterService();
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand("test");
    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
          name: "foo",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result).toBe(parseResult);
  });

  test("empty invalidArguments returns original parseResult", async () => {
    const prompter = new MockPrompterService();
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand("test");
    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result).toBe(parseResult);
  });

  test("missing STRING option prompts TEXT", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("foo", "bar");
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand("test", [
      {
        name: "foo",
        description: "foo option",
        type: ArgumentValueTypeName.STRING,
        isOptional: false,
      },
    ]);

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "foo",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    expect(
      (result.populatedArgumentValues as Record<string, unknown>)["foo"],
    ).toEqual("bar");
  });

  test("missing BOOLEAN option prompts TOGGLE", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("flag", true);
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand("test", [
      {
        name: "flag",
        description: "flag option",
        type: ArgumentValueTypeName.BOOLEAN,
        isOptional: false,
      },
    ]);

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "flag",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    expect(
      (result.populatedArgumentValues as Record<string, unknown>)["flag"],
    ).toEqual(true);
  });

  test("missing option with allowableValues prompts SINGLE_SELECT", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("color", "blue");
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand("test", [
      {
        name: "color",
        description: "color option",
        type: ArgumentValueTypeName.STRING,
        isOptional: false,
        allowableValues: ["red", "blue", "green"],
      },
    ]);

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "color",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    expect(
      (result.populatedArgumentValues as Record<string, unknown>)["color"],
    ).toEqual("blue");
  });

  test("missing INTEGER option coerces string to number", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("count", "42");
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand("test", [
      {
        name: "count",
        description: "count option",
        type: ArgumentValueTypeName.INTEGER,
        isOptional: false,
      },
    ]);

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "count",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    expect(
      (result.populatedArgumentValues as Record<string, unknown>)["count"],
    ).toEqual(42);
  });

  test("SubCommand with multiple missing values prompts for each", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("name", "Alice");
    prompter.addResponse("age", "30");
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand("test", [
      {
        name: "name",
        description: "name option",
        type: ArgumentValueTypeName.STRING,
        isOptional: false,
      },
      {
        name: "age",
        description: "age option",
        type: ArgumentValueTypeName.INTEGER,
        isOptional: false,
      },
    ]);

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "name",
        },
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "age",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    const values = result.populatedArgumentValues as Record<string, unknown>;
    expect(values["name"]).toEqual("Alice");
    expect(values["age"]).toEqual(30);
  });
});
