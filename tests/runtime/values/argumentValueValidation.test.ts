import { describe, expect, test } from "bun:test";
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

describe("argumentValueValidation Tests", () => {
  test("Option types", () => {
    let option: Option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    };
    let invalidArguments: Array<InvalidArgument> = [];
    expect(validateOptionValue(option, "foo", invalidArguments)).toEqual("foo");
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.NUMBER,
    };
    expect(validateOptionValue(option, "1", invalidArguments)).toEqual(1);
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.NUMBER,
    };
    expect(validateOptionValue(option, "1.1", invalidArguments)).toEqual(1.1);
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.NUMBER,
    };
    expect(validateOptionValue(option, "-1.1", invalidArguments)).toEqual(-1.1);
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.INTEGER,
    };
    expect(validateOptionValue(option, "1", invalidArguments)).toEqual(1);
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.INTEGER,
    };
    expect(validateOptionValue(option, "-1", invalidArguments)).toEqual(-1);
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.SECRET,
    };
    expect(validateOptionValue(option, "xxx", invalidArguments)).toEqual("xxx");
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.BOOLEAN,
    };
    expect(validateOptionValue(option, "true", invalidArguments)).toBeTrue();
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.BOOLEAN,
    };
    expect(validateOptionValue(option, "TRUE", invalidArguments)).toBeTrue();
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.BOOLEAN,
    };
    expect(validateOptionValue(option, "True", invalidArguments)).toBeTrue();
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.BOOLEAN,
    };
    expect(validateOptionValue(option, "false", invalidArguments)).toBeFalse();
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.BOOLEAN,
    };
    expect(validateOptionValue(option, "FALSE", invalidArguments)).toBeFalse();
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.BOOLEAN,
    };
    expect(validateOptionValue(option, "False", invalidArguments)).toBeFalse();
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.BOOLEAN,
    };
    expect(validateOptionValue(option, true, invalidArguments)).toBeTrue();
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.BOOLEAN,
    };
    expect(validateOptionValue(option, false, invalidArguments)).toBeFalse();
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    };
    expect(validateOptionValue(option, "1", invalidArguments)).toEqual("1");
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.NUMBER,
    };
    expect(
      validateOptionValue(option, "foo", invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
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
    expect(
      validateOptionValue(option, "foo", invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
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
    expect(
      validateOptionValue(option, "1.1", invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option,
      name: "foo",
      value: "1.1",
      reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
    }]);
  });

  test("Option array", () => {
    let option: Option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      isArray: true,
    };
    const invalidArguments: Array<InvalidArgument> = [];
    expect(
      validateOptionValue(option, ["foo", "bar"], invalidArguments),
    ).toEqual(
      [
        "foo",
        "bar",
      ],
    );
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.NUMBER,
      isArray: true,
    };
    expect(validateOptionValue(option, ["1", "2"], invalidArguments)).toEqual([
      1,
      2,
    ]);
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.BOOLEAN,
      isArray: true,
    };
    expect(
      validateOptionValue(option, ["true", "false"], invalidArguments),
    ).toEqual(
      [true, false],
    );
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    };
    expect(
      validateOptionValue(option, ["true", "false"], invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option,
      name: "foo",
      value: ["true", "false"],
      reason: InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES,
    }]);
  });

  test("Optional option", () => {
    let option: Option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      isOptional: true,
    };
    let invalidArguments: Array<InvalidArgument> = [];
    expect(
      validateOptionValue(option, undefined, invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      isArray: true,
      isOptional: true,
    };
    expect(
      validateOptionValue(option, undefined, invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    };
    expect(
      validateOptionValue(option, undefined, invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
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
    expect(
      validateOptionValue(option, undefined, invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option,
      name: "foo",
      reason: InvalidArgumentReason.MISSING_VALUE,
    }]);
  });

  test("Invalid option argument value", () => {
    let option: Option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      allowableValues: ["bar", "two"],
    };
    const invalidArguments: Array<InvalidArgument> = [];
    expect(validateOptionValue(option, "bar", invalidArguments), "bar");
    expect(invalidArguments).toEqual([]);

    option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      allowableValues: ["bar", "two"],
    };
    expect(
      validateOptionValue(option, "goo", invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option,
      name: "foo",
      value: "goo",
      reason: InvalidArgumentReason.ILLEGAL_VALUE,
    }]);
  });

  test("Complex options", () => {
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
    expect(
      validateOptionValue(option, { a: 1, b: 2 }, invalidArguments),
    ).toEqual(
      { a: 1, b: 2 },
    );
    expect(invalidArguments).toEqual([]);

    invalidArguments = [];

    expect(
      validateOptionValue(option, { a: "bar", b: 2 }, invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option.properties[0],
      name: "foo.a",
      value: "bar",
      reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
    }]);

    invalidArguments = [];

    expect(
      validateOptionValue(option, { b: 2 }, invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option.properties[0],
      name: "foo.a",
      reason: InvalidArgumentReason.MISSING_VALUE,
    }]);

    invalidArguments = [];

    expect(
      validateOptionValue(option, { a: [1, 2], b: 2 }, invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option.properties[0],
      name: "foo.a",
      value: [1, 2],
      reason: InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES,
    }]);

    invalidArguments = [];

    expect(
      validateOptionValue(option, "bar", invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option,
      name: "foo",
      value: "bar",
      reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
    }]);

    invalidArguments = [];

    expect(
      validateOptionValue(option, { a: 1, b: { c: 3 } }, invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option.properties[1],
      name: "foo.b",
      value: { c: 3 },
      reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
    }]);
  });

  test("Option array of complex options", () => {
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
    expect(
      validateOptionValue(option, [{ a: 1, b: 2 }], invalidArguments),
    ).toEqual(
      [{ a: 1, b: 2 }],
    );
    expect(invalidArguments).toEqual([]);

    expect(
      validateOptionValue(
        option,
        [{ a: 1, b: 2 }, { a: 3, b: 4 }],
        invalidArguments,
      ),
    ).toEqual(
      [{ a: 1, b: 2 }, { a: 3, b: 4 }],
    );
    expect(invalidArguments).toEqual([]);

    invalidArguments = [];

    expect(
      validateOptionValue(
        option,
        [{ a: 1, b: 2 }, { a: "bar", b: 4 }],
        invalidArguments,
      ),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option.properties[0],
      name: "foo[1].a",
      value: "bar",
      reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
    }]);

    invalidArguments = [];

    expect(
      validateOptionValue(option, [{ a: 1, b: 2 }, { b: 4 }], invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option.properties[0],
      name: "foo[1].a",
      reason: InvalidArgumentReason.MISSING_VALUE,
    }]);

    invalidArguments = [];

    expect(
      validateOptionValue(
        option,
        [undefined, { a: 3, b: 4 }],
        invalidArguments,
      ),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option,
      name: "foo[0]",
      reason: InvalidArgumentReason.ILLEGAL_SPARSE_ARRAY,
    }]);
  });

  test("Complex nested options", () => {
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
    expect(
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
    ).toEqual(
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
    expect(invalidArguments).toEqual([]);

    invalidArguments = [];

    expect(
      validateOptionValue(
        option,
        [
          {
            beta: 1,
          },
        ],
        invalidArguments,
      ),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: option.properties[0],
      name: "alpha[0].beta",
      reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
      value: 1,
    }]);
  });

  test("Complex sparse array options", () => {
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

    expect(
      validateOptionValue(option, value, invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: (option.properties[0] as ComplexOption).properties[0],
      name: "alpha[0].beta[0].gamma",
      reason: 0,
    }]);
  });

  test("Positional types", () => {
    let positional: Positional = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    };
    let invalidArguments: Array<InvalidArgument> = [];
    expect(
      validatePositionalValue(positional, "foo", invalidArguments),
      "foo",
    );
    expect(invalidArguments).toEqual([]);

    positional = {
      name: "foo",
      type: ArgumentValueTypeName.NUMBER,
    };
    expect(validatePositionalValue(positional, "1", invalidArguments)).toEqual(
      1,
    );
    expect(invalidArguments).toEqual([]);

    positional = {
      name: "foo",
      type: ArgumentValueTypeName.BOOLEAN,
    };
    expect(
      validatePositionalValue(positional, "true", invalidArguments),
    ).toBeTrue();
    expect(invalidArguments).toEqual([]);

    positional = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    };
    expect(
      validatePositionalValue(positional, "1", invalidArguments),
    ).toEqual(
      "1",
    );
    expect(invalidArguments).toEqual([]);

    positional = {
      name: "foo",
      type: ArgumentValueTypeName.NUMBER,
    };
    expect(
      validatePositionalValue(positional, "foo", invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
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
    expect(
      validatePositionalValue(positional, "foo", invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: positional,
      name: "foo",
      value: "foo",
      reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
    }]);
  });

  test("Positional varargs multiple", () => {
    let positional: Positional = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      isVarargMultiple: true,
    };
    const invalidArguments: Array<InvalidArgument> = [];
    expect(
      validatePositionalValue(positional, ["foo", "bar"], invalidArguments),
    ).toEqual(
      ["foo", "bar"],
    );
    expect(invalidArguments).toEqual([]);

    positional = {
      name: "foo",
      type: ArgumentValueTypeName.NUMBER,
      isVarargMultiple: true,
    };
    expect(
      validatePositionalValue(positional, ["1", "2"], invalidArguments),
    ).toEqual(
      [1, 2],
    );
    expect(invalidArguments).toEqual([]);

    positional = {
      name: "foo",
      type: ArgumentValueTypeName.BOOLEAN,
      isVarargMultiple: true,
    };
    expect(
      validatePositionalValue(positional, ["true", "false"], invalidArguments),
    ).toEqual(
      [true, false],
    );
    expect(invalidArguments).toEqual([]);

    positional = {
      name: "foo",
      type: ArgumentValueTypeName.BOOLEAN,
      isVarargMultiple: true,
    };
    expect(
      validatePositionalValue(positional, undefined, invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: positional,
      name: "foo",
      reason: InvalidArgumentReason.MISSING_VALUE,
    }]);
  });

  test("Positional varargs optional", () => {
    let positional: Positional = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      isVarargOptional: true,
    };
    let invalidArguments: Array<InvalidArgument> = [];
    expect(
      validatePositionalValue(positional, undefined, invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([]);

    positional = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      isVarargOptional: true,
    };
    expect(
      validatePositionalValue(positional, "foo", invalidArguments),
      "foo",
    );
    expect(invalidArguments).toEqual([]);

    positional = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      isVarargOptional: true,
    };
    expect(
      validatePositionalValue(positional, ["foo", "bar"], invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
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
    expect(
      validatePositionalValue(positional, ["foo", "bar"], invalidArguments),
    ).toEqual(
      ["foo", "bar"],
    );
    expect(invalidArguments).toEqual([]);
  });

  test("Invalid positional argument value", () => {
    let positional: Option = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      allowableValues: ["bar", "two"],
    };
    const invalidArguments: Array<InvalidArgument> = [];
    expect(
      validatePositionalValue(positional, "bar", invalidArguments),
      "bar",
    );
    expect(invalidArguments).toEqual([]);

    positional = {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      allowableValues: ["bar", "two"],
    };
    expect(
      validatePositionalValue(positional, "goo", invalidArguments),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: positional,
      name: "foo",
      value: "goo",
      reason: InvalidArgumentReason.ILLEGAL_VALUE,
    }]);
  });

  test("Global command argument types", () => {
    let globalCommandArgument: GlobalCommandArgument = {
      type: ArgumentValueTypeName.STRING,
    };
    let globalCommand = getGlobalCommandWithShortAlias(
      "globalCommand",
      "f",
      globalCommandArgument,
    );
    let invalidArguments: Array<InvalidArgument> = [];
    expect(
      validateGlobalCommandArgumentValue(
        globalCommand,
        "foo",
        invalidArguments,
      ),
      "foo",
    );
    expect(invalidArguments).toEqual([]);

    globalCommandArgument = {
      type: ArgumentValueTypeName.NUMBER,
    };
    globalCommand = getGlobalCommandWithShortAlias(
      "globalCommand",
      "f",
      globalCommandArgument,
    );
    expect(
      validateGlobalCommandArgumentValue(
        globalCommand,
        "1",
        invalidArguments,
      ),
    ).toEqual(
      1,
    );
    expect(invalidArguments).toEqual([]);

    globalCommandArgument = {
      type: ArgumentValueTypeName.BOOLEAN,
    };
    globalCommand = getGlobalCommandWithShortAlias(
      "globalCommand",
      "f",
      globalCommandArgument,
    );
    expect(
      validateGlobalCommandArgumentValue(
        globalCommand,
        "true",
        invalidArguments,
      ),
    ).toBeTrue();
    expect(invalidArguments).toEqual([]);

    globalCommandArgument = {
      type: ArgumentValueTypeName.STRING,
    };
    globalCommand = getGlobalCommandWithShortAlias(
      "globalCommand",
      "f",
      globalCommandArgument,
    );
    expect(
      validateGlobalCommandArgumentValue(
        globalCommand,
        "1",
        invalidArguments,
      ),
      "1",
    );
    expect(invalidArguments).toEqual([]);

    globalCommandArgument = {
      type: ArgumentValueTypeName.NUMBER,
    };
    globalCommand = getGlobalCommandWithShortAlias(
      "globalCommand",
      "f",
      globalCommandArgument,
    );
    expect(
      validateGlobalCommandArgumentValue(
        globalCommand,
        "foo",
        invalidArguments,
      ),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
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
    expect(
      validateGlobalCommandArgumentValue(
        globalCommand,
        "foo",
        invalidArguments,
      ),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: globalCommandArgument,
      name: "globalCommand",
      value: "foo",
      reason: InvalidArgumentReason.INCORRECT_VALUE_TYPE,
    }]);
  });

  test("Optional global command argument", () => {
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
    expect(
      validateGlobalCommandArgumentValue(
        globalCommand,
        undefined,
        invalidArguments,
      ),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([]);

    globalCommandArgument = {
      type: ArgumentValueTypeName.STRING,
    };
    globalCommand = getGlobalCommandWithShortAlias(
      "globalCommand",
      "f",
      globalCommandArgument,
    );
    expect(
      validateGlobalCommandArgumentValue(
        globalCommand,
        undefined,
        invalidArguments,
      ),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: globalCommandArgument,
      name: "globalCommand",
      reason: InvalidArgumentReason.MISSING_VALUE,
    }]);
  });

  test("Invalid global command argument value", () => {
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
    expect(
      validateGlobalCommandArgumentValue(
        globalCommand,
        "bar",
        invalidArguments,
      ),
      "bar",
    );
    expect(invalidArguments).toEqual([]);

    globalCommandArgument = {
      type: ArgumentValueTypeName.STRING,
      allowableValues: ["bar", "two"],
    };
    globalCommand = getGlobalCommandWithShortAlias(
      "globalCommand",
      "f",
      globalCommandArgument,
    );
    expect(
      validateGlobalCommandArgumentValue(
        globalCommand,
        "goo",
        invalidArguments,
      ),
    ).toBeUndefined();
    expect(invalidArguments).toEqual([{
      argument: globalCommandArgument,
      name: "globalCommand",
      value: "goo",
      reason: InvalidArgumentReason.ILLEGAL_VALUE,
    }]);
  });
});
