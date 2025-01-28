import { assertEquals, assertFalse } from "@std/assert";
import type { GlobalCommandValuePopulationResult } from "../../../src/runtime/values/ValuePopulationResult.ts";
import populateGlobalCommandValue from "../../../src/runtime/values/globalCommandValuePopulation.ts";
import { InvalidArgumentReason } from "../../../src/api/RunResult.ts";
import type GlobalCommand from "../../../src/api/command/GlobalCommand.ts";
import {
  type ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "../../../src/api/argument/ArgumentValueTypes.ts";

function expectExtractResult(
  result: GlobalCommandValuePopulationResult,
  value: ArgumentSingleValueType | undefined,
  unusedArgs: ReadonlyArray<string>,
) {
  assertEquals(result.populatedArgumentValue, value);
  assertEquals(result.unusedArgs, unusedArgs);
}

Deno.test("Global command argument", () => {
  const command: GlobalCommand = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
    },
    execute: async (): Promise<void> => {
    },
  };

  const result = populateGlobalCommandValue(
    command,
    ["bar"],
    undefined,
  );
  expectExtractResult(result, "bar", []);
  assertFalse(result.invalidArgument);
});

Deno.test("Global command argument types", () => {
  let command: GlobalCommand = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.NUMBER,
    },
    execute: async (): Promise<void> => {
    },
  };

  let result = populateGlobalCommandValue(
    command,
    ["1.1"],
    undefined,
  );
  expectExtractResult(result, "1.1", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.INTEGER,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["1"],
    undefined,
  );
  expectExtractResult(result, "1", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.SECRET,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["xxx"],
    undefined,
  );
  expectExtractResult(result, "xxx", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["bar"],
    undefined,
  );
  expectExtractResult(result, "bar", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    [],
    undefined,
  );
  expectExtractResult(result, "true", []);
  assertFalse(result.invalidArgument);

  result = populateGlobalCommandValue(
    command,
    ["false"],
    undefined,
  );
  expectExtractResult(result, "false", []);
  assertFalse(result.invalidArgument);
});

Deno.test("Global command boolean argument with defaults", () => {
  let command: GlobalCommand = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
    },
    execute: async (): Promise<void> => {
    },
  };

  let result = populateGlobalCommandValue(
    command,
    [],
    undefined,
  );
  expectExtractResult(result, "true", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["true"],
    undefined,
  );
  expectExtractResult(result, "true", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["false"],
    undefined,
  );
  expectExtractResult(result, "false", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
      defaultValue: true,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    [],
    undefined,
  );
  expectExtractResult(result, true, []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
      defaultValue: true,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["false"],
    undefined,
  );
  expectExtractResult(result, "false", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
      defaultValue: false,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    [],
    undefined,
  );
  expectExtractResult(result, "true", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
      defaultValue: false,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["false"],
    undefined,
  );
  expectExtractResult(result, "false", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
      defaultValue: false,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["true"],
    undefined,
  );
  expectExtractResult(result, "true", []);
  assertFalse(result.invalidArgument);
});

Deno.test("Argument following is not used if not applicable to a boolean", () => {
  const command: GlobalCommand = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
    },
    execute: async (): Promise<void> => {
    },
  };

  let result = populateGlobalCommandValue(
    command,
    ["--bar"],
    undefined,
  );
  expectExtractResult(result, "true", ["--bar"]);
  assertFalse(result.invalidArgument);

  result = populateGlobalCommandValue(
    command,
    ["True"],
    undefined,
  );
  expectExtractResult(result, "True", []);
  assertFalse(result.invalidArgument);

  result = populateGlobalCommandValue(
    command,
    ["FALSE"],
    undefined,
  );
  expectExtractResult(result, "FALSE", []);
  assertFalse(result.invalidArgument);
});

Deno.test("Missing argument", () => {
  let command: GlobalCommand = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
    },
    execute: async (): Promise<void> => {
    },
  };

  let result = populateGlobalCommandValue(
    command,
    [],
    undefined,
  );
  expectExtractResult(result, undefined, []);
  assertEquals(result.invalidArgument, {
    name: "foo",
    reason: InvalidArgumentReason.MISSING_VALUE,
  });

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
      isOptional: true,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    [],
    undefined,
  );
  expectExtractResult(result, undefined, []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
      defaultValue: "bar",
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    [],
    undefined,
  );
  expectExtractResult(result, "bar", []);
  assertFalse(result.invalidArgument);
});

Deno.test("Unused option after global command argument", () => {
  const command: GlobalCommand = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
    },
    execute: async (): Promise<void> => {
    },
  };

  const result = populateGlobalCommandValue(
    command,
    ["bar", "--goo", "gar"],
    undefined,
  );
  expectExtractResult(result, "bar", ["--goo", "gar"]);
  assertFalse(result.invalidArgument);
});

Deno.test("Unused positional after global command argument", () => {
  const command: GlobalCommand = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
    },
    execute: async (): Promise<void> => {
    },
  };

  const result = populateGlobalCommandValue(
    command,
    ["bar", "goo"],
    undefined,
  );
  expectExtractResult(result, "bar", ["goo"]);
  assertFalse(result.invalidArgument);
});

Deno.test("Global command default value is overridden by arg", () => {
  let command: GlobalCommand = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.NUMBER,
      defaultValue: 0,
    },
    execute: async (): Promise<void> => {
    },
  };
  let result = populateGlobalCommandValue(
    command,
    ["1"],
    undefined,
  );
  expectExtractResult(result, "1", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
      defaultValue: "foo",
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["bar"],
    undefined,
  );
  expectExtractResult(result, "bar", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
      defaultValue: false,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["false"],
    undefined,
  );
  expectExtractResult(result, "false", []);
  assertFalse(result.invalidArgument);
});

Deno.test("Global command configured value is overridden by arg", () => {
  let command: GlobalCommand = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.NUMBER,
    },
    execute: async (): Promise<void> => {
    },
  };

  let result = populateGlobalCommandValue(
    command,
    ["1"],
    0,
  );
  expectExtractResult(result, "1", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["bar"],
    "foo",
  );
  expectExtractResult(result, "bar", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["true"],
    "false",
  );
  expectExtractResult(result, "true", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    ["false"],
    "true",
  );
  expectExtractResult(result, "false", []);
  assertFalse(result.invalidArgument);
});

Deno.test("Global command default value is overridden by configured value", () => {
  let command: GlobalCommand = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.NUMBER,
      defaultValue: 0,
    },
    execute: async (): Promise<void> => {
    },
  };

  let result = populateGlobalCommandValue(
    command,
    [],
    1,
  );
  expectExtractResult(result, 1, []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
      defaultValue: "foo",
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    [],
    "bar",
  );
  expectExtractResult(result, "bar", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
      defaultValue: false,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    [],
    "true",
  );
  expectExtractResult(result, "true", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.BOOLEAN,
      defaultValue: true,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    [],
    "false",
  );
  expectExtractResult(result, "false", []);
  assertFalse(result.invalidArgument);
});

Deno.test("Missing argument when configured value is provided is not an error", () => {
  let command: GlobalCommand = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
    },
    execute: async (): Promise<void> => {
    },
  };

  let result = populateGlobalCommandValue(
    command,
    [],
    1,
  );
  expectExtractResult(result, 1, []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
      isOptional: true,
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    [],
    "foo",
  );
  expectExtractResult(result, "foo", []);
  assertFalse(result.invalidArgument);

  command = {
    name: "foo",
    argument: {
      type: ArgumentValueTypeName.STRING,
      defaultValue: "bar",
    },
    execute: async (): Promise<void> => {
    },
  };

  result = populateGlobalCommandValue(
    command,
    [],
    "foo",
  );
  expectExtractResult(result, "foo", []);
  assertFalse(result.invalidArgument);
});
