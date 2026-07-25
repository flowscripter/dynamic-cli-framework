import { describe, expect, test } from "bun:test";
import type { ComplexOption } from "@flowscripter/dynamic-cli-framework-api";
import { ValueTypeName, ComplexValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { Positional } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
import { isComplexOption } from "../../../src/runtime/argument/ArgumentTypeGuards.ts";
import type { Option } from "@flowscripter/dynamic-cli-framework-api";

function getComplexOption(): ComplexOption {
  return {
    name: "option",
    type: ComplexValueTypeName.COMPLEX,
    properties: [getOption()],
  };
}

function getOption(): Option {
  return {
    name: "option",
    type: ValueTypeName.STRING,
  };
}

function getPositional(): Positional {
  return {
    name: "positional",
    type: ValueTypeName.STRING,
  };
}

function getGlobalCommandArgument(): GlobalCommandArgument {
  return {
    type: ValueTypeName.STRING,
  };
}

describe("ArgumentTypeGuards tests", () => {
  test("isComplexOption works", () => {
    expect(isComplexOption(getComplexOption())).toBeTrue();
    expect(isComplexOption(getOption())).toBeFalse();
    expect(isComplexOption(getPositional())).toBeFalse();
    expect(isComplexOption(getGlobalCommandArgument())).toBeFalse();
  });
});
