import { describe, expect, test } from "bun:test";
import DefaultArgumentPrompterService from "../../../src/service/argumentPrompter/DefaultArgumentPrompterService.ts";
import type PrompterService from "../../../src/api/service/core/PrompterService.ts";
import type { Prompt, PromptResult } from "../../../src/api/service/core/PrompterService.ts";
import type { ParseResult } from "../../../src/runtime/parser.ts";
import { InvalidArgumentReason } from "../../../src/api/RunResult.ts";
import {
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "../../../src/api/argument/ArgumentValueTypes.ts";
import type SubCommand from "../../../src/api/command/SubCommand.ts";
import type GlobalCommand from "../../../src/api/command/GlobalCommand.ts";
import type ComplexOption from "../../../src/api/argument/ComplexOption.ts";

class MockPrompterService implements PrompterService {
  promptEnabled = true;
  #responses: Map<string, PromptResult> = new Map();

  addResponse(name: string, value: PromptResult["value"]) {
    this.#responses.set(name, { name, value });
  }

  prompt(promptDef: Prompt): Promise<PromptResult> {
    const result = this.#responses.get(promptDef.name);
    if (!result) {
      return Promise.reject(new Error(`No mock response for prompt: ${promptDef.name}`));
    }
    return Promise.resolve(result);
  }

  async promptAll(prompts: ReadonlyArray<Prompt>): Promise<ReadonlyArray<PromptResult>> {
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

function makeGlobalCommand(
  name: string,
  argType: ArgumentValueTypeName = ArgumentValueTypeName.STRING,
): GlobalCommand {
  return {
    name,
    description: `${name} description`,
    argument: {
      type: argType,
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
    expect((result.populatedArgumentValues as Record<string, unknown>)["foo"]).toEqual("bar");
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
    expect((result.populatedArgumentValues as Record<string, unknown>)["flag"]).toEqual(true);
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
    expect((result.populatedArgumentValues as Record<string, unknown>)["color"]).toEqual("blue");
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
    expect((result.populatedArgumentValues as Record<string, unknown>)["count"]).toEqual(42);
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

  test("GlobalCommand with missing argument prompts and returns value", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("myglob", "hello");
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeGlobalCommand("myglob");

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: undefined,
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "myglob",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    expect(result.populatedArgumentValues).toEqual("hello");
  });

  test("GlobalCommand with no argument returns original parseResult", async () => {
    const prompter = new MockPrompterService();
    const service = new DefaultArgumentPrompterService(prompter);

    // GlobalCommand with no argument property
    const command = {
      name: "noarg",
      description: "no arg command",
    } as GlobalCommand;

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: undefined,
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "noarg",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result).toBe(parseResult);
  });

  test("GlobalCommand with INTEGER argument coerces value", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("count", "99");
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeGlobalCommand("count", ArgumentValueTypeName.INTEGER);

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: undefined,
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
    expect(result.populatedArgumentValues).toEqual(99);
  });

  test("SubCommand with complex option prompts for nested properties", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("addr.street", "123 Main St");
    prompter.addResponse("addr.city", "Springfield");
    const service = new DefaultArgumentPrompterService(prompter);

    const complexOption: ComplexOption = {
      name: "addr",
      description: "address",
      type: ComplexValueTypeName.COMPLEX,
      properties: [
        {
          name: "street",
          description: "street name",
          type: ArgumentValueTypeName.STRING,
          isOptional: false,
        },
        {
          name: "city",
          description: "city name",
          type: ArgumentValueTypeName.STRING,
          isOptional: false,
        },
      ],
    };

    const command = makeSubCommand("test", [
      complexOption as unknown as SubCommand["options"][number],
    ]);

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "addr",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    const values = result.populatedArgumentValues as Record<string, unknown>;
    const addr = values["addr"] as Record<string, unknown>;
    expect(addr["street"]).toEqual("123 Main St");
    expect(addr["city"]).toEqual("Springfield");
  });

  test("SubCommand with complex option skips optional properties with defaults", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("addr.street", "123 Main St");
    const service = new DefaultArgumentPrompterService(prompter);

    const complexOption: ComplexOption = {
      name: "addr",
      description: "address",
      type: ComplexValueTypeName.COMPLEX,
      properties: [
        {
          name: "street",
          description: "street name",
          type: ArgumentValueTypeName.STRING,
          isOptional: false,
        },
        {
          name: "zip",
          description: "zip code",
          type: ArgumentValueTypeName.STRING,
          isOptional: true,
          defaultValue: "00000",
        },
      ],
    };

    const command = makeSubCommand("test", [
      complexOption as unknown as SubCommand["options"][number],
    ]);

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "addr",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    const values = result.populatedArgumentValues as Record<string, unknown>;
    const addr = values["addr"] as Record<string, unknown>;
    expect(addr["street"]).toEqual("123 Main St");
    expect(addr["zip"]).toBeUndefined();
  });

  test("SubCommand with array option prompts for multiple values", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("tags", "alpha");
    prompter.addResponse("tags_more", true);
    const service = new DefaultArgumentPrompterService(prompter);

    // Override prompt to return different values on successive calls
    let callCount = 0;
    const responses: Array<{ name: string; value: unknown }> = [
      { name: "tags", value: "alpha" },
      { name: "tags_more", value: true },
      { name: "tags", value: "beta" },
      { name: "tags_more", value: false },
    ];
    prompter.prompt = () => {
      const resp = responses[callCount]!;
      callCount++;
      return Promise.resolve(resp as PromptResult);
    };

    const command = makeSubCommand("test", [
      {
        name: "tags",
        description: "tags list",
        type: ArgumentValueTypeName.STRING,
        isOptional: false,
        isArray: true,
      },
    ]);

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "tags",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    const values = result.populatedArgumentValues as Record<string, unknown>;
    expect(values["tags"]).toEqual(["alpha", "beta"]);
  });

  test("SubCommand with missing positional prompts for value", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("file", "/tmp/data.txt");
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand(
      "test",
      [],
      [
        {
          name: "file",
          description: "file path",
          type: ArgumentValueTypeName.STRING,
        },
      ],
    );

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "file",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    const values = result.populatedArgumentValues as Record<string, unknown>;
    expect(values["file"]).toEqual("/tmp/data.txt");
  });

  test("SubCommand with unknown argument name pushes to remainingInvalid", async () => {
    const prompter = new MockPrompterService();
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand("test", [
      {
        name: "known",
        description: "known option",
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
          name: "unknown_arg",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(1);
    expect(result.invalidArguments[0]!.name).toEqual("unknown_arg");
  });

  test("SubCommand with invalid name=undefined pushes to remainingInvalid", async () => {
    const prompter = new MockPrompterService();
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand("test");

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(1);
  });

  test("NUMBER type coerces string to float", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("ratio", "3.14");
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand("test", [
      {
        name: "ratio",
        description: "ratio option",
        type: ArgumentValueTypeName.NUMBER,
        isOptional: false,
      },
    ]);

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "ratio",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    const values = result.populatedArgumentValues as Record<string, unknown>;
    expect(values["ratio"]).toBeCloseTo(3.14);
  });

  test("BOOLEAN type coerces string 'true' to boolean true", async () => {
    const prompter = new MockPrompterService();
    prompter.addResponse("enabled", "true");
    const service = new DefaultArgumentPrompterService(prompter);

    const command = makeSubCommand("test", [
      {
        name: "enabled",
        description: "enabled option",
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
          name: "enabled",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    const values = result.populatedArgumentValues as Record<string, unknown>;
    expect(values["enabled"]).toEqual(true);
  });

  test("prompt error returns original parseResult", async () => {
    const prompter = new MockPrompterService();
    const service = new DefaultArgumentPrompterService(prompter);

    // No mock responses added, so prompt will reject
    const command = makeGlobalCommand("failing");

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: undefined,
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "failing",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result).toBe(parseResult);
  });

  test("vararg positional triggers array prompting", async () => {
    const prompter = new MockPrompterService();
    const service = new DefaultArgumentPrompterService(prompter);

    let callCount = 0;
    const responses: Array<{ name: string; value: unknown }> = [
      { name: "files", value: "a.txt" },
      { name: "files_more", value: false },
    ];
    prompter.prompt = () => {
      const resp = responses[callCount]!;
      callCount++;
      return Promise.resolve(resp as PromptResult);
    };

    const command = makeSubCommand(
      "test",
      [],
      [
        {
          name: "files",
          description: "file paths",
          type: ArgumentValueTypeName.STRING,
          isVarargMultiple: true,
        },
      ],
    );

    const parseResult: ParseResult = {
      command,
      populatedArgumentValues: {},
      invalidArguments: [
        {
          reason: InvalidArgumentReason.MISSING_VALUE,
          name: "files",
        },
      ],
      unusedArgs: [],
    };

    const result = await service.promptForMissingArguments(parseResult);
    expect(result.invalidArguments.length).toEqual(0);
    const values = result.populatedArgumentValues as Record<string, unknown>;
    expect(values["files"]).toEqual(["a.txt"]);
  });
});
