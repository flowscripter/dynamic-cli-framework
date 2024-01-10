import { assertEquals, describe, it } from "../../test_deps.ts";
import ComplexOption from "../../../src/api/argument/ComplexOption.ts";
import {
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "../../../src/api/argument/ArgumentValueTypes.ts";
import Positional from "../../../src/api/argument/Positional.ts";
import GlobalCommandArgument from "../../../src/api/argument/GlobalCommandArgument.ts";
import { isComplexOption } from "../../../src/api/argument/ArgumentTypeGuards.ts";
import Option from "../../../src/api/argument/Option.ts";

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

describe("ArgumentTypeGuards", () => {
  it("isComplexOption works", () => {
    assertEquals(isComplexOption(getComplexOption()), true);
    assertEquals(isComplexOption(getOption()), false);
    assertEquals(isComplexOption(getPositional()), false);
    assertEquals(isComplexOption(getGlobalCommandArgument()), false);
  });
});
