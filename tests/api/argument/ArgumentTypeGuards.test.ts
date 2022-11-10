import { assertEquals, describe, it } from "../../test_deps.ts";
import {
  ArgumentValueTypeName,
  ComplexOption,
  ComplexValueTypeName,
  GlobalCommandArgument,
  Option,
  Positional,
} from "../../../mod.ts";
import { isComplexOption } from "../../../src/api/argument/ArgumentTypeGuards.ts";

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
    name: "option",
    type: ArgumentValueTypeName.STRING,
  };
}

describe("ArgumentTypeGuards", () => {
  it("isComplexOption works", () => {
    assertEquals(isComplexOption(getComplexOption()), true);
    assertEquals(isComplexOption(getOption()), false);
    assertEquals(isComplexOption(getPositional()), false);
    assertEquals(isComplexOption(getGlobalCommandArgument()), false);
  });
});
