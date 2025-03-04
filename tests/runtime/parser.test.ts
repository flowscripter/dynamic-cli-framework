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
import { InvalidArgumentReason } from "../../src/api/RunResult.ts";
import type ComplexOption from "../../src/api/argument/ComplexOption.ts";
import {
  type ArgumentValueType,
  ArgumentValueTypeName,
  ComplexValueTypeName,
  type PopulatedArgumentValues,
} from "../../src/api/argument/ArgumentValueTypes.ts";
import type SubCommand from "../../src/api/command/SubCommand.ts";

function expectParseResult(result: ParseResult, expected: ParseResult) {
  expect(
    result.populatedArgumentValues,
  ).toEqual(
    expected.populatedArgumentValues!,
  );
  expect(result.unusedArgs).toEqual(expected.unusedArgs);
  expect(result.invalidArguments).toEqual(expected.invalidArguments);
}

describe("parser Tests", () => {
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
    const globalModifierCommand = getGlobalModifierCommand(
      "modifierCommand",
      "m",
      true,
      true,
    );

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

    const parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: [],
    }, {
      goo: "g",
      foo: "bar",
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

  test("Some arguments provided in config", () => {
    const subCommand = getSubCommandWithOptionAndPositional();

    let parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["--goo", "g"],
    }, {
      foo: "bar",
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
      potentialArgs: ["bar"],
    }, {
      goo: "g",
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

  test("Extra config provided", () => {
    const subCommand = getSubCommandWithOptionAndPositional();

    const parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: ["--goo", "g"],
    }, {
      foo: "bar",
      yee: "ha",
    });
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
              delta: [
                "1",
              ],
              gamma: "foo1",
            },
          },
        ],
      },
      unusedArgs: [
        "-a.b.d=2",
        "-a.b.d=3",
        "-e.g=bar",
        "-e.d=1",
      ],
      invalidArguments: [{
        argument: ((subCommand.options[0] as ComplexOption)
          .properties[0] as ComplexOption).properties[0],
        reason: InvalidArgumentReason.ILLEGAL_MULTIPLE_VALUES,
        name: "gamma",
      }],
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
              delta: [
                "1",
                "2",
                "3",
              ],
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
      potentialArgs: [
        "-e.g=bar",
        "-e.d=1",
        "-a.b[1].g=foo2",
        "-a.b[1].d[1]=2",
        "-a.b[1].d[0]=3",
      ],
    });

    let argumentValues: PopulatedArgumentValues = {
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

    ((argumentValues.alpha as Array<PopulatedArgumentValues>)[0].beta as Array<
      PopulatedArgumentValues
    >)[1] = {
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
      alpha: [{
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
      }],
      epsilon: {
        gamma: "bar",
        delta: 1,
      },
    };

    // these are still stored as strings as the validation (and type conversion) failed fast
    (((argumentValues.alpha as Array<PopulatedArgumentValues>)[0].beta as Array<
      PopulatedArgumentValues
    >)[1].delta as Array<ArgumentValueType>)[0] = "0";
    (((argumentValues.alpha as Array<PopulatedArgumentValues>)[0].beta as Array<
      PopulatedArgumentValues
    >)[1].delta as Array<ArgumentValueType>)[2] = "2";

    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: argumentValues,
      unusedArgs: [],
      invalidArguments: [
        {
          argument: ((subCommand.options[0] as ComplexOption)
            .properties[0] as ComplexOption).properties[1],
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
      potentialArgs: [
        "-a.b.g=foo1",
        "-a.b.d=1",
        "-a.b.d=2",
        "-a.b.d=3",
        "-e.d=1",
      ],
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        alpha: [{
          beta: {
            gamma: "foo1",
            delta: [1, 2, 3],
          },
        }],
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

    const parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: [
        "-a.b[1].g=foo2",
        "--alpha.beta[0].gamma=foo1",
        "-a.b[1].d[1]=2",
        "-a.b[0].d=1",
        "-a.b[1].d[0]=3",
      ],
    }, {
      epsilon: {
        gamma: "bar",
        delta: 1,
      },
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        alpha: [
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

    const parseResult = parseSubCommandClause({
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
    }, {
      epsilon: {
        gamma: "bar",
        delta: 1,
      },
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        alpha: [
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

    const parseResult = parseSubCommandClause({
      command: subCommand,
      potentialArgs: [],
    }, {
      alpha: [
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
      epsilon: {
        gamma: "bar",
        delta: 1,
      },
    });
    expectParseResult(parseResult, {
      command: subCommand,
      populatedArgumentValues: {
        alpha: [
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
      options: [{
        name: "alpha",
        shortAlias: "a",
        type: ComplexValueTypeName.COMPLEX,
        isArray: true,
        defaultValue: [
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
      }, {
        name: "epsilon",
        shortAlias: "e",
        type: ComplexValueTypeName.COMPLEX,
        defaultValue: {
          gamma: "bar",
          delta: 1,
        },
        properties: [{
          name: "gamma",
          shortAlias: "g",
          type: ArgumentValueTypeName.STRING,
        }, {
          name: "delta",
          shortAlias: "d",
          type: ArgumentValueTypeName.NUMBER,
        }],
      }],
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
        epsilon: {
          gamma: "bar",
          delta: 1,
        },
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });
});
