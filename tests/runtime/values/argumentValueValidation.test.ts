import { assertEquals } from "@std/assert";
import {
  validateGlobalCommandArgumentValue,
  validateOptionValue,
  validatePositionalValue,
} from "../../../src/runtime/values/argumentValueValidation.ts";
import {
  type InvalidArgument,
  InvalidArgumentReason,
} from "../../../src/api/RunResult.ts";
import { getGlobalCommandWithShortAlias } from "../../fixtures/Command.ts";
import {
  ArgumentValueTypeName,
  ComplexValueTypeName,
  type PopulatedArgumentValues,
} from "../../../src/api/argument/ArgumentValueTypes.ts";
import type ComplexOption from "../../../src/api/argument/ComplexOption.ts";
import type Positional from "../../../src/api/argument/Positional.ts";
import type GlobalCommandArgument from "../../../src/api/argument/GlobalCommandArgument.ts";
import type Option from "../../../src/api/argument/Option.ts";

Deno.test("Option types", () => {
  let option: Option = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
  };
  let invalidArguments: Array<InvalidArgument> = [];
  assertEquals(validateOptionValue(option, "foo", invalidArguments), "foo");
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.NUMBER,
  };
  assertEquals(validateOptionValue(option, "1", invalidArguments), 1);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.NUMBER,
  };
  assertEquals(validateOptionValue(option, "1.1", invalidArguments), 1.1);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.NUMBER,
  };
  assertEquals(validateOptionValue(option, "-1.1", invalidArguments), -1.1);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.INTEGER,
  };
  assertEquals(validateOptionValue(option, "1", invalidArguments), 1);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.INTEGER,
  };
  assertEquals(validateOptionValue(option, "-1", invalidArguments), -1);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.SECRET,
  };
  assertEquals(validateOptionValue(option, "xxx", invalidArguments), "xxx");
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
  };
  assertEquals(validateOptionValue(option, "true", invalidArguments), true);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
  };
  assertEquals(validateOptionValue(option, "TRUE", invalidArguments), true);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
  };
  assertEquals(validateOptionValue(option, "True", invalidArguments), true);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
  };
  assertEquals(validateOptionValue(option, "false", invalidArguments), false);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
  };
  assertEquals(validateOptionValue(option, "FALSE", invalidArguments), false);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
  };
  assertEquals(validateOptionValue(option, "False", invalidArguments), false);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
  };
  assertEquals(validateOptionValue(option, true, invalidArguments), true);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
  };
  assertEquals(validateOptionValue(option, false, invalidArguments), false);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
  };
  assertEquals(validateOptionValue(option, "1", invalidArguments), "1");
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.NUMBER,
  };
  assertEquals(
    validateOptionValue(option, "foo", invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option,
    name: "foo",
    value: "foo",
    reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
  }]);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
  };
  invalidArguments = [];
  assertEquals(
    validateOptionValue(option, "foo", invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option,
    name: "foo",
    value: "foo",
    reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
  }]);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.INTEGER,
  };
  invalidArguments = [];
  assertEquals(
    validateOptionValue(option, "1.1", invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option,
    name: "foo",
    value: "1.1",
    reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
  }]);
});

Deno.test("Option array", () => {
  let option: Option = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    isArray: true,
  };
  const invalidArguments: Array<InvalidArgument> = [];
  assertEquals(
    validateOptionValue(option, ["foo", "bar"], invalidArguments),
    [
      "foo",
      "bar",
    ],
  );
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.NUMBER,
    isArray: true,
  };
  assertEquals(validateOptionValue(option, ["1", "2"], invalidArguments), [
    1,
    2,
  ]);
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
    isArray: true,
  };
  assertEquals(
    validateOptionValue(option, ["true", "false"], invalidArguments),
    [true, false],
  );
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
  };
  assertEquals(
    validateOptionValue(option, ["true", "false"], invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option,
    name: "foo",
    value: ["true", "false"],
    reason: InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES,
  }]);
});

Deno.test("Optional option", () => {
  let option: Option = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    isOptional: true,
  };
  let invalidArguments: Array<InvalidArgument> = [];
  assertEquals(
    validateOptionValue(option, undefined, invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    isArray: true,
    isOptional: true,
  };
  assertEquals(
    validateOptionValue(option, undefined, invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
  };
  assertEquals(
    validateOptionValue(option, undefined, invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option,
    name: "foo",
    reason: InvalidArgumentReason.MISSING_VALUE,
  }]);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    isArray: true,
  };
  invalidArguments = [];
  assertEquals(
    validateOptionValue(option, undefined, invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option,
    name: "foo",
    reason: InvalidArgumentReason.MISSING_VALUE,
  }]);
});

Deno.test("Invalid option argument value", () => {
  let option: Option = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    allowableValues: ["bar", "two"],
  };
  const invalidArguments: Array<InvalidArgument> = [];
  assertEquals(validateOptionValue(option, "bar", invalidArguments), "bar");
  assertEquals(invalidArguments, []);

  option = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    allowableValues: ["bar", "two"],
  };
  assertEquals(
    validateOptionValue(option, "goo", invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option,
    name: "foo",
    value: "goo",
    reason: InvalidArgumentReason.ILLEGAL_VALUE,
  }]);
});

Deno.test("Complex options", () => {
  const option: ComplexOption = {
    name: "foo",
    type: ComplexValueTypeName.COMPLEX,
    properties: [
      {
        name: "a",
        type: ArgumentValueTypeName.NUMBER,
      },
      {
        name: "b",
        type: ArgumentValueTypeName.NUMBER,
      },
    ],
  };
  let invalidArguments: Array<InvalidArgument> = [];
  assertEquals(
    validateOptionValue(option, { a: 1, b: 2 }, invalidArguments),
    { a: 1, b: 2 },
  );
  assertEquals(invalidArguments, []);

  invalidArguments = [];

  assertEquals(
    validateOptionValue(option, { a: "bar", b: 2 }, invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option.properties[0],
    name: "foo.a",
    value: "bar",
    reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
  }]);

  invalidArguments = [];

  assertEquals(
    validateOptionValue(option, { b: 2 }, invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option.properties[0],
    name: "foo.a",
    reason: InvalidArgumentReason.MISSING_VALUE,
  }]);

  invalidArguments = [];

  assertEquals(
    validateOptionValue(option, { a: [1, 2], b: 2 }, invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option.properties[0],
    name: "foo.a",
    value: [1, 2],
    reason: InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES,
  }]);

  invalidArguments = [];

  assertEquals(
    validateOptionValue(option, "bar", invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option,
    name: "foo",
    value: "bar",
    reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
  }]);

  invalidArguments = [];

  assertEquals(
    validateOptionValue(option, { a: 1, b: { c: 3 } }, invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option.properties[1],
    name: "foo.b",
    value: { c: 3 },
    reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
  }]);
});

Deno.test("Option array of complex options", () => {
  const option: ComplexOption = {
    name: "foo",
    type: ComplexValueTypeName.COMPLEX,
    isArray: true,
    properties: [
      {
        name: "a",
        type: ArgumentValueTypeName.NUMBER,
      },
      {
        name: "b",
        type: ArgumentValueTypeName.NUMBER,
      },
    ],
  };
  let invalidArguments: Array<InvalidArgument> = [];
  assertEquals(
    validateOptionValue(option, [{ a: 1, b: 2 }], invalidArguments),
    [{ a: 1, b: 2 }],
  );
  assertEquals(invalidArguments, []);

  assertEquals(
    validateOptionValue(
      option,
      [{ a: 1, b: 2 }, { a: 3, b: 4 }],
      invalidArguments,
    ),
    [{ a: 1, b: 2 }, { a: 3, b: 4 }],
  );
  assertEquals(invalidArguments, []);

  invalidArguments = [];

  assertEquals(
    validateOptionValue(
      option,
      [{ a: 1, b: 2 }, { a: "bar", b: 4 }],
      invalidArguments,
    ),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option.properties[0],
    name: "foo[1].a",
    value: "bar",
    reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
  }]);

  invalidArguments = [];

  assertEquals(
    validateOptionValue(option, [{ a: 1, b: 2 }, { b: 4 }], invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option.properties[0],
    name: "foo[1].a",
    reason: InvalidArgumentReason.MISSING_VALUE,
  }]);

  invalidArguments = [];

  assertEquals(
    validateOptionValue(
      option,
      [undefined, { a: 3, b: 4 }],
      invalidArguments,
    ),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option,
    name: "foo[0]",
    reason: InvalidArgumentReason.ILLEGAL_SPARSE_ARRAY,
  }]);
});

Deno.test("Complex nested options", () => {
  const option: ComplexOption = {
    name: "alpha",
    shortAlias: "a",
    type: ComplexValueTypeName.COMPLEX,
    isArray: true,
    properties: [{
      name: "beta",
      shortAlias: "b",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
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
  };
  let invalidArguments: Array<InvalidArgument> = [];
  assertEquals(
    validateOptionValue(option, [
      {
        beta: [
          {
            delta: [
              1,
            ],
            gamma: "foo1",
          },
          {
            delta: [
              3,
              2,
            ],
            gamma: "foo2",
          },
        ],
      },
    ], invalidArguments),
    [
      {
        beta: [
          {
            delta: [
              1,
            ],
            gamma: "foo1",
          },
          {
            delta: [
              3,
              2,
            ],
            gamma: "foo2",
          },
        ],
      },
    ],
  );
  assertEquals(invalidArguments, []);

  invalidArguments = [];

  assertEquals(
    validateOptionValue(
      option,
      [
        {
          beta: 1,
        },
      ],
      invalidArguments,
    ),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: option.properties[0],
    name: "alpha[0].beta",
    reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
    value: 1,
  }]);
});

Deno.test("Complex sparse array options", () => {
  const option: ComplexOption = {
    name: "alpha",
    shortAlias: "a",
    type: ComplexValueTypeName.COMPLEX,
    isArray: true,
    properties: [{
      name: "beta",
      shortAlias: "b",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
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
  };
  const invalidArguments: Array<InvalidArgument> = [];
  const value: Array<PopulatedArgumentValues> = [{
    beta: [
      {},
      {
        gamma: "foo1",
        delta: [3, 2],
      },
    ],
  }];

  assertEquals(
    validateOptionValue(option, value, invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: (option.properties[0] as ComplexOption).properties[0],
    name: "alpha[0].beta[0].gamma",
    reason: 0,
  }]);
});

Deno.test("Positional types", () => {
  let positional: Positional = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
  };
  let invalidArguments: Array<InvalidArgument> = [];
  assertEquals(
    validatePositionalValue(positional, "foo", invalidArguments),
    "foo",
  );
  assertEquals(invalidArguments, []);

  positional = {
    name: "foo",
    type: ArgumentValueTypeName.NUMBER,
  };
  assertEquals(validatePositionalValue(positional, "1", invalidArguments), 1);
  assertEquals(invalidArguments, []);

  positional = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
  };
  assertEquals(
    validatePositionalValue(positional, "true", invalidArguments),
    true,
  );
  assertEquals(invalidArguments, []);

  positional = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
  };
  assertEquals(
    validatePositionalValue(positional, "1", invalidArguments),
    "1",
  );
  assertEquals(invalidArguments, []);

  positional = {
    name: "foo",
    type: ArgumentValueTypeName.NUMBER,
  };
  assertEquals(
    validatePositionalValue(positional, "foo", invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: positional,
    name: "foo",
    value: "foo",
    reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
  }]);

  positional = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
  };
  invalidArguments = [];
  assertEquals(
    validatePositionalValue(positional, "foo", invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: positional,
    name: "foo",
    value: "foo",
    reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
  }]);
});

Deno.test("Positional varargs multiple", () => {
  let positional: Positional = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    isVarargMultiple: true,
  };
  const invalidArguments: Array<InvalidArgument> = [];
  assertEquals(
    validatePositionalValue(positional, ["foo", "bar"], invalidArguments),
    ["foo", "bar"],
  );
  assertEquals(invalidArguments, []);

  positional = {
    name: "foo",
    type: ArgumentValueTypeName.NUMBER,
    isVarargMultiple: true,
  };
  assertEquals(
    validatePositionalValue(positional, ["1", "2"], invalidArguments),
    [1, 2],
  );
  assertEquals(invalidArguments, []);

  positional = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
    isVarargMultiple: true,
  };
  assertEquals(
    validatePositionalValue(positional, ["true", "false"], invalidArguments),
    [true, false],
  );
  assertEquals(invalidArguments, []);

  positional = {
    name: "foo",
    type: ArgumentValueTypeName.BOOLEAN,
    isVarargMultiple: true,
  };
  assertEquals(
    validatePositionalValue(positional, undefined, invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: positional,
    name: "foo",
    reason: InvalidArgumentReason.MISSING_VALUE,
  }]);
});

Deno.test("Positional varargs optional", () => {
  let positional: Positional = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    isVarargOptional: true,
  };
  let invalidArguments: Array<InvalidArgument> = [];
  assertEquals(
    validatePositionalValue(positional, undefined, invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, []);

  positional = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    isVarargOptional: true,
  };
  assertEquals(
    validatePositionalValue(positional, "foo", invalidArguments),
    "foo",
  );
  assertEquals(invalidArguments, []);

  positional = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    isVarargOptional: true,
  };
  assertEquals(
    validatePositionalValue(positional, ["foo", "bar"], invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: positional,
    name: "foo",
    value: ["foo", "bar"],
    reason: InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES,
  }]);

  positional = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    isVarargMultiple: true,
    isVarargOptional: true,
  };
  invalidArguments = [];
  assertEquals(
    validatePositionalValue(positional, ["foo", "bar"], invalidArguments),
    ["foo", "bar"],
  );
  assertEquals(invalidArguments, []);
});

Deno.test("Invalid positional argument value", () => {
  let positional: Option = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    allowableValues: ["bar", "two"],
  };
  const invalidArguments: Array<InvalidArgument> = [];
  assertEquals(
    validatePositionalValue(positional, "bar", invalidArguments),
    "bar",
  );
  assertEquals(invalidArguments, []);

  positional = {
    name: "foo",
    type: ArgumentValueTypeName.STRING,
    allowableValues: ["bar", "two"],
  };
  assertEquals(
    validatePositionalValue(positional, "goo", invalidArguments),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: positional,
    name: "foo",
    value: "goo",
    reason: InvalidArgumentReason.ILLEGAL_VALUE,
  }]);
});

Deno.test("Global command argument types", () => {
  let globalCommandArgument: GlobalCommandArgument = {
    type: ArgumentValueTypeName.STRING,
  };
  let globalCommand = getGlobalCommandWithShortAlias(
    "globalCommand",
    "f",
    globalCommandArgument,
  );
  let invalidArguments: Array<InvalidArgument> = [];
  assertEquals(
    validateGlobalCommandArgumentValue(
      globalCommand,
      "foo",
      invalidArguments,
    ),
    "foo",
  );
  assertEquals(invalidArguments, []);

  globalCommandArgument = {
    type: ArgumentValueTypeName.NUMBER,
  };
  globalCommand = getGlobalCommandWithShortAlias(
    "globalCommand",
    "f",
    globalCommandArgument,
  );
  assertEquals(
    validateGlobalCommandArgumentValue(
      globalCommand,
      "1",
      invalidArguments,
    ),
    1,
  );
  assertEquals(invalidArguments, []);

  globalCommandArgument = {
    type: ArgumentValueTypeName.BOOLEAN,
  };
  globalCommand = getGlobalCommandWithShortAlias(
    "globalCommand",
    "f",
    globalCommandArgument,
  );
  assertEquals(
    validateGlobalCommandArgumentValue(
      globalCommand,
      "true",
      invalidArguments,
    ),
    true,
  );
  assertEquals(invalidArguments, []);

  globalCommandArgument = {
    type: ArgumentValueTypeName.STRING,
  };
  globalCommand = getGlobalCommandWithShortAlias(
    "globalCommand",
    "f",
    globalCommandArgument,
  );
  assertEquals(
    validateGlobalCommandArgumentValue(
      globalCommand,
      "1",
      invalidArguments,
    ),
    "1",
  );
  assertEquals(invalidArguments, []);

  globalCommandArgument = {
    type: ArgumentValueTypeName.NUMBER,
  };
  globalCommand = getGlobalCommandWithShortAlias(
    "globalCommand",
    "f",
    globalCommandArgument,
  );
  assertEquals(
    validateGlobalCommandArgumentValue(
      globalCommand,
      "foo",
      invalidArguments,
    ),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: globalCommandArgument,
    name: "globalCommand",
    value: "foo",
    reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
  }]);

  globalCommandArgument = {
    type: ArgumentValueTypeName.BOOLEAN,
  };
  globalCommand = getGlobalCommandWithShortAlias(
    "globalCommand",
    "f",
    globalCommandArgument,
  );
  invalidArguments = [];
  assertEquals(
    validateGlobalCommandArgumentValue(
      globalCommand,
      "foo",
      invalidArguments,
    ),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: globalCommandArgument,
    name: "globalCommand",
    value: "foo",
    reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
  }]);
});

Deno.test("Optional global command argument", () => {
  let globalCommandArgument: GlobalCommandArgument = {
    type: ArgumentValueTypeName.STRING,
    isOptional: true,
  };
  let globalCommand = getGlobalCommandWithShortAlias(
    "globalCommand",
    "f",
    globalCommandArgument,
  );
  const invalidArguments: Array<InvalidArgument> = [];
  assertEquals(
    validateGlobalCommandArgumentValue(
      globalCommand,
      undefined,
      invalidArguments,
    ),
    undefined,
  );
  assertEquals(invalidArguments, []);

  globalCommandArgument = {
    type: ArgumentValueTypeName.STRING,
  };
  globalCommand = getGlobalCommandWithShortAlias(
    "globalCommand",
    "f",
    globalCommandArgument,
  );
  assertEquals(
    validateGlobalCommandArgumentValue(
      globalCommand,
      undefined,
      invalidArguments,
    ),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: globalCommandArgument,
    name: "globalCommand",
    reason: InvalidArgumentReason.MISSING_VALUE,
  }]);
});

Deno.test("Invalid global command argument value", () => {
  let globalCommandArgument: GlobalCommandArgument = {
    type: ArgumentValueTypeName.STRING,
    allowableValues: ["bar", "two"],
  };
  let globalCommand = getGlobalCommandWithShortAlias(
    "globalCommand",
    "f",
    globalCommandArgument,
  );
  const invalidArguments: Array<InvalidArgument> = [];
  assertEquals(
    validateGlobalCommandArgumentValue(
      globalCommand,
      "bar",
      invalidArguments,
    ),
    "bar",
  );
  assertEquals(invalidArguments, []);

  globalCommandArgument = {
    type: ArgumentValueTypeName.STRING,
    allowableValues: ["bar", "two"],
  };
  globalCommand = getGlobalCommandWithShortAlias(
    "globalCommand",
    "f",
    globalCommandArgument,
  );
  assertEquals(
    validateGlobalCommandArgumentValue(
      globalCommand,
      "goo",
      invalidArguments,
    ),
    undefined,
  );
  assertEquals(invalidArguments, [{
    argument: globalCommandArgument,
    name: "globalCommand",
    value: "goo",
    reason: InvalidArgumentReason.ILLEGAL_VALUE,
  }]);
});
