import { describe, expect, test } from "bun:test";
import {
  getGlobalCommand,
  getGlobalModifierCommand,
  getSubCommandWithComplexOptions,
  getSubCommandWithOptionAndPositional,
} from "../fixtures/Command.ts";
import {
  parseGlobalCommandClause,
  type ParseResult,
  parseSubCommandClause,
} from "../../src/runtime/parser.ts";
import { InvalidArgumentReason } from "@flowscripter/dynamic-cli-framework-api";
import { getInvalidArgumentString } from "../../src/runtime/values/argumentValueValidation.ts";
import type { ComplexOption } from "@flowscripter/dynamic-cli-framework-api";
import {
  type ValueType,
  ValueTypeName,
  ComplexValueTypeName,
  type PopulatedValues,
} from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { ValidationContext } from "@flowscripter/dynamic-cli-framework-api";

function expectParseResult(result: ParseResult, expected: ParseResult) {
  expect(result.populatedArgumentValues).toEqual(expected.populatedArgumentValues!);
  expect(result.unusedArgs).toEqual(expected.unusedArgs);
  expect(result.invalidArguments).toEqual(expected.invalidArguments);
}

describe("parser tests", () => {
  test("Arguments parsed for sub-command", () => {
    const subCommand = getSubCommandWithOptionAndPositional();

    let parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["bar", "--goo", "g"],
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        goo: "g",
        foo: "bar",
      },
      unusedArgs: [],
      invalidArguments: [],
    });

    parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["bar", "-g=g"],
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        goo: "g",
        foo: "bar",
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  test("Quoted string parsing works", () => {
    const subCommand = getSubCommandWithOptionAndPositional();

    let parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["bar with more", "--goo", "g with more"],
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        goo: "g with more",
        foo: "bar with more",
      },
      unusedArgs: [],
      invalidArguments: [],
    });

    parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["bar with more", "-g=g with more"],
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        goo: "g with more",
        foo: "bar with more",
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  test("Arguments parsed for global command", () => {
    const globalCommand = getGlobalCommand("globalCommand", true);

    const parseResult = parseGlobalCommandClause({
      command: globalCommand,
      potentialArgs: ["foo"],
    });
    expectParseResult(parseResult, {
      command: globalCommand,
      populatedArgumentValues: "foo",
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  test("Arguments parsed for global modifier command", () => {
    const globalModifierCommand = getGlobalModifierCommand("modifierCommand", "m", true, true);

    const parseResult = parseGlobalCommandClause({
      command: globalModifierCommand,
      potentialArgs: ["foo"],
    });
    expectParseResult(parseResult, {
      command: globalModifierCommand,
      populatedArgumentValues: "foo",
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  test("Arguments parsed with trailing args", () => {
    const subCommand = getSubCommandWithOptionAndPositional();

    const parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["bar", "--goo", "g", "hello", "--world"],
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        goo: "g",
        foo: "bar",
      },
      unusedArgs: ["hello", "--world"],
      invalidArguments: [],
    });
  });

  test("All arguments provided in config", () => {
    const subCommand = getSubCommandWithOptionAndPositional();

    const parseResult = parseSubCommandClause(
      {
        command: subCommand,
        potentialArgs: [],
      },
      {
        goo: "g",
        foo: "bar",
      },
    );
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        goo: "g",
        foo: "bar",
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  test("Some arguments provided in config", () => {
    const subCommand = getSubCommandWithOptionAndPositional();

    let parseResult = parseSubCommandClause(
      {
        command: subCommand,
        potentialArgs: ["--goo", "g"],
      },
      {
        foo: "bar",
      },
    );
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        goo: "g",
        foo: "bar",
      },
      unusedArgs: [],
      invalidArguments: [],
    });

    parseResult = parseSubCommandClause(
      {
        command: subCommand,
        potentialArgs: ["bar"],
      },
      {
        goo: "g",
      },
    );
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        goo: "g",
        foo: "bar",
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  test("Extra config provided", () => {
    const subCommand = getSubCommandWithOptionAndPositional();

    const parseResult = parseSubCommandClause(
      {
        command: subCommand,
        potentialArgs: ["--goo", "g"],
      },
      {
        foo: "bar",
        yee: "ha",
      },
    );
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        goo: "g",
        foo: "bar",
        yee: "ha",
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  test("Arguments parsed for sub-command with complex options", () => {
    const subCommand = getSubCommandWithComplexOptions(false, true);

    const parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: [
        "-e.g=bar",
        "-e.d=1",
        "-a.b[1].g=foo2",
        "--alpha.beta[0].gamma=foo1",
        "-a.b[1].d[1]=2",
        "-a.b[0].d=1",
        "-a.b[1].d[0]=3",
      ],
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        alpha: [
          {
            beta: [
              {
                delta: [1],
                gamma: "foo1",
              },
              {
                delta: [3, 2],
                gamma: "foo2",
              },
            ],
          },
        ],
        epsilon: {
          gamma: "bar",
          delta: 1,
        },
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  test("Arguments parsed for sub-command with complex options (illegal scenarios)", () => {
    const subCommand = getSubCommandWithComplexOptions();

    let parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: [
        "-a.b.g=foo1",
        "-a.b.d=1",
        "-a.b.g=foo2",
        "-a.b.d=2",
        "-a.b.d=3",
        "-e.g=bar",
        "-e.d=1",
      ],
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        alpha: [
          {
            beta: {
              delta: ["1"],
              gamma: "foo1",
            },
          },
        ],
      },
      unusedArgs: ["-a.b.d=2", "-a.b.d=3", "-e.g=bar", "-e.d=1"],
      invalidArguments: [
        {
          argument: ((subCommand.options[0] as ComplexOption).properties[0] as ComplexOption)
            .properties[0],
          reason: InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES,
          name: "gamma",
        },
      ],
    });

    parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: [
        "--alpha.beta.gamma=foo1",
        "-a.b.d=1",
        "-a.b.d=2",
        "-a.b.d=3",
        "-e.g=bar",
        "-e.d=1",
        "-e.d=2",
      ],
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        alpha: [
          {
            beta: {
              delta: ["1", "2", "3"],
              gamma: "foo1",
            },
          },
        ],
        epsilon: {
          gamma: "bar",
          delta: "1",
        },
      },
      unusedArgs: [],
      invalidArguments: [
        {
          name: "delta",
          argument: (subCommand.options[1] as ComplexOption).properties[1],
          reason: InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES,
        },
      ],
    });
  });

  test("Arguments parsed for sub-command with complex options and sparse array", () => {
    const subCommand = getSubCommandWithComplexOptions(false, true);

    let parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["-e.g=bar", "-e.d=1", "-a.b[1].g=foo2", "-a.b[1].d[1]=2", "-a.b[1].d[0]=3"],
    });

    let argumentValues: PopulatedValues = {
      alpha: [
        {
          beta: [],
        },
      ],
      epsilon: {
        gamma: "bar",
        delta: 1,
      },
    };

    ((argumentValues.alpha as Array<PopulatedValues>)[0]!.beta as Array<PopulatedValues>)[1] = {
      gamma: "foo2",
      delta: ["3", "2"], // these are still stored as strings as the validation (and type conversion) failed fast
    };

    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: argumentValues,
      unusedArgs: [],
      invalidArguments: [
        {
          argument: (subCommand.options[0] as ComplexOption).properties[0],
          name: "alpha[0].beta[0]",
          reason: InvalidArgumentReason.ILLEGAL_SPARSE_ARRAY,
        },
      ],
    });

    parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: [
        "-e.g=bar",
        "-e.d=1",
        "-a.b[1].g=foo2",
        "--alpha.beta[0].gamma=foo1",
        "-a.b[1].d[2]=2",
        "-a.b[1].d[0]=0",
        "-a.b[0].d=1",
      ],
    });

    argumentValues = {
      alpha: [
        {
          beta: [
            {
              gamma: "foo1",
              delta: ["1"], // this is still stored as strings as the validation (and type conversion) failed fast
            },
            {
              gamma: "foo2",
              delta: [],
            },
          ],
        },
      ],
      epsilon: {
        gamma: "bar",
        delta: 1,
      },
    };

    // these are still stored as strings as the validation (and type conversion) failed fast
    (
      ((argumentValues.alpha as Array<PopulatedValues>)[0]!.beta as Array<PopulatedValues>)[1]!
        .delta as Array<ValueType>
    )[0] = "0";
    (
      ((argumentValues.alpha as Array<PopulatedValues>)[0]!.beta as Array<PopulatedValues>)[1]!
        .delta as Array<ValueType>
    )[2] = "2";

    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: argumentValues,
      unusedArgs: [],
      invalidArguments: [
        {
          argument: ((subCommand.options[0] as ComplexOption).properties[0] as ComplexOption)
            .properties[1],
          name: "alpha[0].beta[1].delta[1]",
          reason: InvalidArgumentReason.ILLEGAL_SPARSE_ARRAY,
        },
      ],
    });
  });

  test("Arguments parsed for sub-command with complex options and missing property values", () => {
    const subCommand = getSubCommandWithComplexOptions(false, false);

    const parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["-a.b.g=foo1", "-a.b.d=1", "-a.b.d=2", "-a.b.d=3", "-e.d=1"],
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        alpha: [
          {
            beta: {
              gamma: "foo1",
              delta: [1, 2, 3],
            },
          },
        ],
        epsilon: {
          delta: "1",
        },
      },
      unusedArgs: [],
      invalidArguments: [
        {
          argument: (subCommand.options[1] as ComplexOption).properties[0],
          name: "epsilon.gamma",
          reason: InvalidArgumentReason.MISSING_VALUE,
        },
      ],
    });
  });

  test("Arguments parsed for sub-command with complex options and some values provided by config", () => {
    const subCommand = getSubCommandWithComplexOptions(false, true);

    const parseResult = parseSubCommandClause(
      {
        command: subCommand,
        potentialArgs: [
          "-a.b[1].g=foo2",
          "--alpha.beta[0].gamma=foo1",
          "-a.b[1].d[1]=2",
          "-a.b[0].d=1",
          "-a.b[1].d[0]=3",
        ],
      },
      {
        epsilon: {
          gamma: "bar",
          delta: 1,
        },
      },
    );
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        alpha: [
          {
            beta: [
              {
                delta: [1],
                gamma: "foo1",
              },
              {
                delta: [3, 2],
                gamma: "foo2",
              },
            ],
          },
        ],
        epsilon: {
          gamma: "bar",
          delta: 1,
        },
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  test("Arguments parsed for sub-command with complex options and some values provided by config but overridden", () => {
    const subCommand = getSubCommandWithComplexOptions(false, true);

    const parseResult = parseSubCommandClause(
      {
        command: subCommand,
        potentialArgs: [
          "-e.g=bar2",
          "-e.d=2",
          "-a.b[1].g=foo2",
          "--alpha.beta[0].gamma=foo1",
          "-a.b[1].d[1]=2",
          "-a.b[0].d=1",
          "-a.b[1].d[0]=3",
        ],
      },
      {
        epsilon: {
          gamma: "bar",
          delta: 1,
        },
      },
    );
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        alpha: [
          {
            beta: [
              {
                delta: [1],
                gamma: "foo1",
              },
              {
                delta: [3, 2],
                gamma: "foo2",
              },
            ],
          },
        ],
        epsilon: {
          gamma: "bar2",
          delta: 2,
        },
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  test("Arguments parsed for sub-command with complex options and all values provided by config", () => {
    const subCommand = getSubCommandWithComplexOptions(false, true);

    const parseResult = parseSubCommandClause(
      {
        command: subCommand,
        potentialArgs: [],
      },
      {
        alpha: [
          {
            beta: [
              {
                delta: [1],
                gamma: "foo1",
              },
              {
                delta: [3, 2],
                gamma: "foo2",
              },
            ],
          },
        ],
        epsilon: {
          gamma: "bar",
          delta: 1,
        },
      },
    );
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        alpha: [
          {
            beta: [
              {
                delta: [1],
                gamma: "foo1",
              },
              {
                delta: [3, 2],
                gamma: "foo2",
              },
            ],
          },
        ],
        epsilon: {
          gamma: "bar",
          delta: 1,
        },
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  test("Arguments parsed for sub-command with complex options and all values provided by default value", () => {
    const subCommand: SubCommand = {
      name: "subCommand",
      options: [
        {
          name: "alpha",
          shortAlias: "a",
          type: ComplexValueTypeName.COMPLEX,
          isArray: true,
          defaultValue: [
            {
              beta: [
                {
                  delta: [1],
                  gamma: "foo1",
                },
                {
                  delta: [3, 2],
                  gamma: "foo2",
                },
              ],
            },
          ],
          properties: [
            {
              name: "beta",
              shortAlias: "b",
              type: ComplexValueTypeName.COMPLEX,
              isArray: true,
              properties: [
                {
                  name: "gamma",
                  shortAlias: "g",
                  type: ValueTypeName.STRING,
                },
                {
                  name: "delta",
                  shortAlias: "d",
                  type: ValueTypeName.NUMBER,
                  isArray: true,
                },
              ],
            },
          ],
        },
        {
          name: "epsilon",
          shortAlias: "e",
          type: ComplexValueTypeName.COMPLEX,
          defaultValue: {
            gamma: "bar",
            delta: 1,
          },
          properties: [
            {
              name: "gamma",
              shortAlias: "g",
              type: ValueTypeName.STRING,
            },
            {
              name: "delta",
              shortAlias: "d",
              type: ValueTypeName.NUMBER,
            },
          ],
        },
      ],
      positionals: [],
      execute: async (): Promise<void> => {},
    };

    const parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: [],
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        alpha: [
          {
            beta: [
              {
                delta: [1],
                gamma: "foo1",
              },
              {
                delta: [3, 2],
                gamma: "foo2",
              },
            ],
          },
        ],
        epsilon: {
          gamma: "bar",
          delta: 1,
        },
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  test("Nested custom validator failures are reported with the property path", () => {
    const field = {
      name: "field",
      type: ValueTypeName.STRING,
      validate: (value: ValueType | PopulatedValues | Array<PopulatedValues>) =>
        value === "x" ? "x is not allowed" : undefined,
    };
    const subCommand: SubCommand = {
      name: "subCommand",
      options: [
        {
          name: "opt",
          type: ComplexValueTypeName.COMPLEX,
          isOptional: true,
          properties: [
            {
              name: "sub",
              type: ComplexValueTypeName.COMPLEX,
              properties: [field],
            },
          ],
        },
        {
          name: "arr",
          type: ComplexValueTypeName.COMPLEX,
          isArray: true,
          isOptional: true,
          properties: [field],
        },
      ],
      positionals: [],
      execute: async (): Promise<void> => {},
    };

    let parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["--opt.sub.field=x"],
    });
    expect(parseResult.invalidArguments).toEqual([
      {
        argument: field,
        name: "opt.sub.field",
        value: "x",
        reason: InvalidArgumentReason.CUSTOM_VALIDATION,
        message: "x is not allowed",
      },
    ]);
    expect(getInvalidArgumentString(parseResult.invalidArguments[0]!, false)).toEqual(
      "opt.sub.field='x' (custom validation: x is not allowed)",
    );

    parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["--arr[0].field=y", "--arr[1].field=x"],
    });
    expect(parseResult.invalidArguments).toEqual([
      {
        argument: field,
        name: "arr[1].field",
        value: "x",
        reason: InvalidArgumentReason.CUSTOM_VALIDATION,
        message: "x is not allowed",
      },
    ]);
    expect(getInvalidArgumentString(parseResult.invalidArguments[0]!, false)).toEqual(
      "arr[1].field='x' (custom validation: x is not allowed)",
    );
  });

  test("Custom validators receive all provided values regardless of declaration order", () => {
    const seen: Array<unknown> = [];
    const conflict = (other: string) => (value: unknown, ctx: ValidationContext) => {
      const values = ctx.values as PopulatedValues;
      seen.push({ path: ctx.path, argument: ctx.argument.type, command: ctx.command.name });
      return value === "x" && values[other] === "y"
        ? `${ctx.path} conflicts with ${other}`
        : undefined;
    };
    const makeCommand = (first: "a" | "b"): SubCommand => {
      const a = {
        name: "a",
        type: ValueTypeName.STRING,
        isOptional: true,
        validate: conflict("b"),
      };
      const b = {
        name: "b",
        type: ValueTypeName.STRING,
        isOptional: true,
        validate: conflict("a"),
      };
      return {
        name: "subCommand",
        options: first === "a" ? [a, b] : [b, a],
        positionals: [],
        execute: async (): Promise<void> => {},
      };
    };

    for (const first of ["a", "b"] as const) {
      const parseResult = parseSubCommandClause({
        command: makeCommand(first),
        potentialArgs: ["--a=x", "--b=y"],
      });
      expect(parseResult.invalidArguments.length).toEqual(1);
      expect(parseResult.invalidArguments[0]!.reason).toEqual(
        InvalidArgumentReason.CUSTOM_VALIDATION,
      );
    }
    expect(seen[0]).toEqual({ path: "a", argument: ValueTypeName.STRING, command: "subCommand" });
  });

  test("Custom validators only run once all built-in validation has passed", () => {
    let called = false;
    const subCommand: SubCommand = {
      name: "subCommand",
      options: [
        {
          name: "a",
          type: ValueTypeName.STRING,
          validate: () => {
            called = true;
            return "never";
          },
        },
        { name: "n", type: ValueTypeName.INTEGER },
      ],
      positionals: [],
      execute: async (): Promise<void> => {},
    };
    const parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["--a=x", "--n=notanumber"],
    });
    expect(called).toBeFalse();
    expect(parseResult.invalidArguments.map((ia) => ia.reason)).toEqual([
      InvalidArgumentReason.INCORRECT_VALUE_TYPE,
    ]);
  });

  test("Nested and array element validators see the root values", () => {
    let rootValues: unknown;
    const field = {
      name: "field",
      type: ValueTypeName.STRING,
      validate: (_: unknown, ctx: ValidationContext) => {
        rootValues = ctx.values;
        return ctx.path === "arr[1].field" ? "bad element" : undefined;
      },
    };
    const subCommand: SubCommand = {
      name: "subCommand",
      options: [
        { name: "plain", type: ValueTypeName.STRING },
        {
          name: "arr",
          type: ComplexValueTypeName.COMPLEX,
          isArray: true,
          properties: [field],
        },
      ],
      positionals: [],
      execute: async (): Promise<void> => {},
    };
    const parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["--plain=p", "--arr[0].field=a", "--arr[1].field=b"],
    });
    expect(parseResult.invalidArguments.map((ia) => ia.name)).toEqual(["arr[1].field"]);
    expect(rootValues).toEqual({
      plain: "p",
      arr: [{ field: "a" }, { field: "b" }],
    });
  });

  test("Global command custom validator receives the argument value as values", () => {
    let received: unknown;
    const command = getGlobalCommand();
    const withValidator = {
      ...command,
      argument: {
        ...command.argument!,
        validate: (value: unknown, ctx: ValidationContext) => {
          received = { value, values: ctx.values, path: ctx.path, command: ctx.command.name };
          return undefined;
        },
      },
    };
    parseGlobalCommandClause({ command: withValidator, potentialArgs: ["foo"] });
    expect(received).toEqual({
      value: "foo",
      values: "foo",
      path: command.name,
      command: command.name,
    });
  });
});
