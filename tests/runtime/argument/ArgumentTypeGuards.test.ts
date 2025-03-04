import { describe, expect, test } from "bun:test";
import type ComplexOption from "../../../src/api/argument/ComplexOption.ts";
import {
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "../../../src/api/argument/ArgumentValueTypes.ts";
import type Positional from "../../../src/api/argument/Positional.ts";
import type GlobalCommandArgument from "../../../src/api/argument/GlobalCommandArgument.ts";
import { isComplexOption } from "../../../src/runtime/argument/ArgumentTypeGuards.ts";
import type Option from "../../../src/api/argument/Option.ts";

function getComplexOption(): ComplexOption {
  return {
    name: "option",
    type: ComplexValueTypeName.COMPLEX,
    properties: [
      getOption(),
    ],
  };
}

function getOption(): Option {
  return {
    name: "option",
    type: ArgumentValueTypeName.STRING,
  };
}

function getPositional(): Positional {
  return {
    name: "positional",
    type: ArgumentValueTypeName.STRING,
  };
}

function getGlobalCommandArgument(): GlobalCommandArgument {
  return {
    type: ArgumentValueTypeName.STRING,
  };
}

describe("ArgumentTypeGuards Tests", () => {
  test("isComplexOption works", () => {
    expect(isComplexOption(getComplexOption())).toBeTrue();
    expect(isComplexOption(getOption())).toBeFalse();
    expect(isComplexOption(getPositional())).toBeFalse();
    expect(isComplexOption(getGlobalCommandArgument())).toBeFalse();
  });
});
