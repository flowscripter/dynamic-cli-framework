import { describe, expect, test } from "bun:test";
import populateSubCommandValues from "../../../src/runtime/values/subCommandValuePopulation.ts";
import {
  ArgumentValueTypeName,
  ComplexValueTypeName,
  type PopulatedArgumentValues,
} from "../../../src/api/argument/ArgumentValueTypes.ts";
import type { SubCommandValuePopulationResult } from "../../../src/runtime/values/ValuePopulationResult.ts";
import { InvalidArgumentReason } from "../../../src/api/RunResult.ts";
import type SubCommand from "../../../src/api/command/SubCommand.ts";
import type ComplexOption from "../../../src/api/argument/ComplexOption.ts";

function expectExtractResult(
  result: SubCommandValuePopulationResult,
  values: PopulatedArgumentValues,
  unusedArgs: ReadonlyArray<string>,
) {
  expect(result.populatedArgumentValues).toEqual(values);
  expect(result.unusedArgs).toEqual(unusedArgs);
}
describe("subCommandValuePopulation tests", () => {
  test("Option argument", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        shortAlias: "f",
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--foo", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo=bar"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["-f", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["-f=bar"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo", "goo=1 and goo=2"],
      undefined,
    );
    expectExtractResult(result, { foo: "goo=1 and goo=2" }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo=goo=1 and goo=2"],
      undefined,
    );
    expectExtractResult(result, { foo: "goo=1 and goo=2" }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option types", () => {
    let command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        shortAlias: "f",
        type: ArgumentValueTypeName.NUMBER,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--foo", "1.1"],
      undefined,
    );
    expectExtractResult(result, { foo: "1.1" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        shortAlias: "f",
        type: ArgumentValueTypeName.INTEGER,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["-f", "1"],
      undefined,
    );
    expectExtractResult(result, { foo: "1" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        shortAlias: "f",
        type: ArgumentValueTypeName.SECRET,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["-f", "xxx"],
      undefined,
    );
    expectExtractResult(result, { foo: "xxx" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        shortAlias: "f",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["-f", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        shortAlias: "f",
        type: ArgumentValueTypeName.BOOLEAN,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["-f"],
      undefined,
    );
    expectExtractResult(result, { foo: "true" }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option array", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        shortAlias: "f",
        isArray: true,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--foo", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo", "bar", "--foo", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar", "bar"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo=bar", "--foo", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar", "bar"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo=bar", "-f", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar", "bar"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo=bar", "-f=bar"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar", "bar"] }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option argument configured value is overridden by arg", () => {
    let command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--foo", "bar"],
      { foo: "nope" },
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.NUMBER,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["--foo", "1"],
      { foo: 2 },
    );
    expectExtractResult(result, { foo: "1" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.BOOLEAN,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["--foo", "true"],
      { foo: false },
    );
    expectExtractResult(result, { foo: "true" }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option argument default value is overridden by configured value", () => {
    let command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        defaultValue: "nope",
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [],
      { foo: "bar" },
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.NUMBER,
        defaultValue: 2,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      [],
      { foo: 1 },
    );
    expectExtractResult(result, { foo: 1 }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.BOOLEAN,
        defaultValue: false,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      [],
      { foo: true },
    );
    expectExtractResult(result, { foo: true }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option argument default value is overridden by arg", () => {
    let command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        defaultValue: "nope",
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--foo", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.NUMBER,
        defaultValue: 2,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["--foo", "1"],
      undefined,
    );
    expectExtractResult(result, { foo: "1" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.BOOLEAN,
        defaultValue: true,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["--foo", "false"],
      undefined,
    );
    expectExtractResult(result, { foo: "false" }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option argument configured value is used if no arg provided", () => {
    let command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [],
      { foo: "bar" },
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.NUMBER,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      [],
      { foo: 1 },
    );
    expectExtractResult(result, { foo: 1 }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.BOOLEAN,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      [],
      { foo: false },
    );
    expectExtractResult(result, { foo: false }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Two options", () => {
    let command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isArray: false,
      }, {
        name: "goo",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--foo", "bar", "--goo=gar"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar", goo: "gar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.BOOLEAN,
        isArray: false,
      }, {
        name: "goo",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["--foo", "--goo=gar"],
      undefined,
    );
    expectExtractResult(result, { foo: "true", goo: "gar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.BOOLEAN,
        isArray: true,
      }, {
        name: "goo",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      [
        "--foo",
        "--foo",
        "false",
        "--goo=gar",
      ],
      undefined,
    );
    expectExtractResult(result, { foo: ["true", "false"], goo: "gar" }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Interleaved option arrays", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isArray: true,
      }, {
        name: "goo",
        type: ArgumentValueTypeName.BOOLEAN,
        isArray: true,
        shortAlias: "g",
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [
        "--foo",
        "bar1",
        "--goo=true",
        "--foo",
        "bar2",
        "--goo=false",
      ],
      undefined,
    );
    expectExtractResult(
      result,
      { foo: ["bar1", "bar2"], goo: ["true", "false"] },
      [],
    );
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      [
        "--foo",
        "bar1",
        "--goo=true",
        "--goo=false",
        "--foo",
        "bar2",
      ],
      undefined,
    );
    expectExtractResult(
      result,
      { foo: ["bar1", "bar2"], goo: ["true", "false"] },
      [],
    );
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      [
        "--foo",
        "bar1",
        "-g",
        "--foo",
        "bar2",
        "-g=false",
      ],
      undefined,
    );
    expectExtractResult(
      result,
      { foo: ["bar1", "bar2"], goo: ["true", "false"] },
      [],
    );
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Unknown option name", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--goo=moo"],
      undefined,
    );
    expectExtractResult(result, {}, ["--goo=moo"]);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--goo", "moo"],
      undefined,
    );
    expectExtractResult(result, {}, ["--goo", "moo"]);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Illegal option syntax", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        shortAlias: "f",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["-foo=moo"],
      undefined,
    );
    expectExtractResult(result, {}, ["-foo=moo"]);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--f", "moo"],
      undefined,
    );
    expectExtractResult(result, {}, ["--f", "moo"]);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo=", "moo"],
      undefined,
    );
    expectExtractResult(result, {}, ["moo"]);
    expect(result.invalidArgument).toEqual({
      name: "foo",
      reason: InvalidArgumentReason.MISSING_VALUE,
    });

    result = populateSubCommandValues(
      command,
      ["-f=", "moo"],
      undefined,
    );
    expectExtractResult(result, {}, ["moo"]);
    expect(result.invalidArgument).toEqual({
      name: "f",
      reason: InvalidArgumentReason.MISSING_VALUE,
    });
  });

  test("Positional argument", () => {
    let command: SubCommand = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["bar"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "bar",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["foo", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: "foo", bar: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Positional types", () => {
    let command: SubCommand = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.NUMBER,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["1"],
      undefined,
    );
    expectExtractResult(result, { foo: "1" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };
    result = populateSubCommandValues(
      command,
      ["bar"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.BOOLEAN,
      }],
      execute: async (): Promise<void> => {
      },
    };
    result = populateSubCommandValues(
      command,
      ["true"],
      undefined,
    );
    expectExtractResult(result, { foo: "true" }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Multiple positionals", () => {
    const command: SubCommand = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo1",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "foo2",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    const result = populateSubCommandValues(
      command,
      ["f1", "f2"],
      undefined,
    );
    expectExtractResult(result, { foo1: "f1", foo2: "f2" }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Positional varargs", () => {
    const command: SubCommand = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isVarargMultiple: true,
        isVarargOptional: true,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["bar", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar", "bar"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["bar"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(command, [], undefined);
    expectExtractResult(result, {}, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Multiple positional and varargs", () => {
    const command: SubCommand = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "bar",
        type: ArgumentValueTypeName.STRING,
        isVarargMultiple: true,
        isVarargOptional: true,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["foo"],
      undefined,
    );
    expectExtractResult(result, { foo: "foo" }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["foo", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: "foo", bar: ["bar"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["foo", "bar", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: "foo", bar: ["bar", "bar"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["foo"],
      undefined,
    );
    expectExtractResult(result, { foo: "foo" }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("String options either side of positionals", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "goo1",
        type: ArgumentValueTypeName.STRING,
        shortAlias: "1",
      }, {
        name: "goo2",
        type: ArgumentValueTypeName.STRING,
        shortAlias: "2",
      }],
      positionals: [{
        name: "foo1",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "foo2",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [
        "--goo1=g1",
        "f1",
        "f2",
        "--goo2=g2",
      ],
      undefined,
    );
    expectExtractResult(result, {
      goo1: "g1",
      goo2: "g2",
      foo1: "f1",
      foo2: "f2",
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      [
        "--goo1",
        "g1",
        "f1",
        "f2",
        "--goo2",
        "g2",
      ],
      undefined,
    );
    expectExtractResult(result, {
      goo1: "g1",
      goo2: "g2",
      foo1: "f1",
      foo2: "f2",
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      [
        "-1",
        "g1",
        "f1",
        "f2",
        "-2",
        "g2",
      ],
      undefined,
    );
    expectExtractResult(result, {
      goo1: "g1",
      goo2: "g2",
      foo1: "f1",
      foo2: "f2",
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Boolean options either side of positionals", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "goo1",
        shortAlias: "1",
        type: ArgumentValueTypeName.BOOLEAN,
      }, {
        name: "goo2",
        shortAlias: "2",
        type: ArgumentValueTypeName.BOOLEAN,
      }],
      positionals: [{
        name: "foo1",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "foo2",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [
        "--goo1",
        "f1",
        "f2",
        "--goo2",
      ],
      undefined,
    );
    expectExtractResult(result, {
      goo1: "true",
      goo2: "true",
      foo1: "f1",
      foo2: "f2",
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      [
        "--goo1",
        "true",
        "f1",
        "f2",
        "--goo2",
        "false",
      ],
      undefined,
    );
    expectExtractResult(result, {
      goo1: "true",
      goo2: "false",
      foo1: "f1",
      foo2: "f2",
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      [
        "-1",
        "true",
        "f1",
        "f2",
        "-2",
        "false",
      ],
      undefined,
    );
    expectExtractResult(result, {
      goo1: "true",
      goo2: "false",
      foo1: "f1",
      foo2: "f2",
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option array either side of positional", () => {
    let command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        isArray: true,
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [{
        name: "goo",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [
        "--foo",
        "f1",
        "goo1",
        "--foo",
        "f2",
      ],
      undefined,
    );
    expectExtractResult(result, {
      foo: ["f1", "f2"],
      goo: "goo1",
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        isArray: true,
        type: ArgumentValueTypeName.BOOLEAN,
      }],
      positionals: [{
        name: "goo",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };
    result = populateSubCommandValues(
      command,
      [
        "--foo",
        "true",
        "goo1",
        "--foo",
        "false",
      ],
      undefined,
    );
    expectExtractResult(result, {
      foo: ["true", "false"],
      goo: "goo1",
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo", "goo1", "--foo"],
      undefined,
    );
    expectExtractResult(result, {
      foo: ["true", "true"],
      goo: "goo1",
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Unused option after used option", () => {
    let command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        shortAlias: "f",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [
        "--foo",
        "bar",
        "--goo",
        "gar",
      ],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, ["--goo", "gar"]);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo=bar", "--goo=gar"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, ["--goo=gar"]);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        shortAlias: "f",
        type: ArgumentValueTypeName.BOOLEAN,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["-f", "--goo", "gar"],
      undefined,
    );
    expectExtractResult(result, { foo: "true" }, ["--goo", "gar"]);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Unused option before used option", () => {
    let command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        shortAlias: "f",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [
        "--goo",
        "gar",
        "--foo",
        "bar",
      ],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, ["--goo", "gar"]);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--goo=gar", "--foo=bar"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, ["--goo=gar"]);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        shortAlias: "f",
        type: ArgumentValueTypeName.BOOLEAN,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["--goo", "gar", "-f"],
      undefined,
    );
    expectExtractResult(result, { foo: "true" }, ["--goo", "gar"]);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Unused option after positional", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo1",
        shortAlias: "1",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [{
        name: "foo2",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    const result = populateSubCommandValues(
      command,
      [
        "--foo1",
        "bar",
        "foo2",
        "--goo",
        "gar",
      ],
      undefined,
    );
    expectExtractResult(result, { foo1: "bar", foo2: "foo2" }, [
      "--goo",
      "gar",
    ]);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Unused option before positional", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo1",
        shortAlias: "1",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [{
        name: "foo2",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    const result = populateSubCommandValues(
      command,
      [
        "--goo", // as this is unrecognised as an option for the command it will be used as a positional value
        "gar",
        "foo2",
        "--foo1",
        "bar",
      ],
      undefined,
    );
    expectExtractResult(result, { foo1: "bar", foo2: "--goo" }, [
      "gar",
      "foo2",
    ]);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Unused positional after positional", () => {
    const command: SubCommand = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    const result = populateSubCommandValues(
      command,
      ["bar", "goo"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, ["goo"]);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Unused positional after optional", () => {
    let command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--foo", "bar", "goo"],
      undefined,
    );
    expectExtractResult(result, { foo: "bar" }, ["goo"]);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.BOOLEAN,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      ["--foo", "goo"],
      undefined,
    );
    expectExtractResult(result, { foo: "true" }, ["goo"]);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Positionals either side of options", () => {
    let command: SubCommand = {
      name: "command",
      options: [{
        name: "goo1",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "goo2",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [{
        name: "foo1",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "foo2",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [
        "f1",
        "--goo1",
        "g1",
        "--goo2",
        "g2",
        "f2",
      ],
      undefined,
    );
    expectExtractResult(result, {
      goo1: "g1",
      goo2: "g2",
      foo1: "f1",
      foo2: "f2",
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "goo1",
        type: ArgumentValueTypeName.BOOLEAN,
      }, {
        name: "goo2",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [{
        name: "foo1",
        type: ArgumentValueTypeName.BOOLEAN,
      }, {
        name: "foo2",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    result = populateSubCommandValues(
      command,
      [
        "true",
        "--goo1",
        "--goo2",
        "g2",
        "f2",
      ],
      undefined,
    );
    expectExtractResult(result, {
      goo1: "true",
      goo2: "g2",
      foo1: "true",
      foo2: "f2",
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Positionals and non-boolean options interleaved", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "goo1",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "goo2",
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [{
        name: "foo1",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "foo2",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [
        "f1",
        "--goo1",
        "g1",
        "f2",
        "--goo2",
        "g2",
      ],
      undefined,
    );
    expectExtractResult(result, {
      goo1: "g1",
      goo2: "g2",
      foo1: "f1",
      foo2: "f2",
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      [
        "--goo1",
        "g1",
        "f1",
        "--goo2",
        "g2",
        "f2",
      ],
      undefined,
    );
    expectExtractResult(result, {
      goo1: "g1",
      goo2: "g2",
      foo1: "f1",
      foo2: "f2",
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Positionals and boolean options interleaved", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "goo1",
        type: ArgumentValueTypeName.BOOLEAN,
      }, {
        name: "goo2",
        type: ArgumentValueTypeName.BOOLEAN,
      }],
      positionals: [{
        name: "foo1",
        type: ArgumentValueTypeName.STRING,
      }, {
        name: "foo2",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [
        "f1",
        "--goo1",
        "true",
        "f2",
        "--goo2",
        "true",
      ],
      undefined,
    );
    expectExtractResult(result, {
      goo1: "true",
      goo2: "true",
      foo1: "f1",
      foo2: "f2",
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["f1", "--goo1", "f2", "--goo2"],
      undefined,
    );
    expectExtractResult(result, {
      goo1: "true",
      goo2: "true",
      foo1: "f1",
      foo2: "f2",
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Array option before vararg positional", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isArray: true,
      }],
      positionals: [{
        name: "goo",
        type: ArgumentValueTypeName.STRING,
        isVarargMultiple: true,
      }],
      execute: async (): Promise<void> => {
      },
    };

    const result = populateSubCommandValues(
      command,
      [
        "--foo",
        "f1",
        "--foo",
        "f2",
        "g1",
        "g2",
      ],
      undefined,
    );
    expectExtractResult(result, {
      foo: ["f1", "f2"],
      goo: ["g1", "g2"],
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Vararg positional before array option", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isArray: true,
      }],
      positionals: [{
        name: "goo",
        type: ArgumentValueTypeName.STRING,
        isVarargMultiple: true,
        isVarargOptional: true,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [
        "g1",
        "g2",
        "--foo",
        "f1",
        "--foo",
        "f2",
      ],
      undefined,
    );
    expectExtractResult(result, {
      foo: ["f1", "f2"],
      goo: ["g1", "g2"],
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo", "f1", "--foo", "f2"],
      undefined,
    );
    expectExtractResult(result, {
      foo: ["f1", "f2"],
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Positional types configured value is overridden by arg", () => {
    let command: SubCommand = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.NUMBER,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["1"],
      { foo: 2 },
    );
    expectExtractResult(result, { foo: "1" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };
    result = populateSubCommandValues(
      command,
      ["bar"],
      { foo: "nope" },
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.BOOLEAN,
      }],
      execute: async (): Promise<void> => {
      },
    };
    result = populateSubCommandValues(
      command,
      ["true"],
      { foo: false },
    );
    expectExtractResult(result, { foo: "true" }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Positional types configured value is used for optional vararg with no arg provided", () => {
    let command: SubCommand = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.NUMBER,
        isVarargOptional: true,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [],
      { foo: 1 },
    );
    expectExtractResult(result, { foo: 1 }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isVarargOptional: true,
      }],
      execute: async (): Promise<void> => {
      },
    };
    result = populateSubCommandValues(
      command,
      [],
      { foo: "bar" },
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.BOOLEAN,
        isVarargOptional: true,
      }],
      execute: async (): Promise<void> => {
      },
    };
    result = populateSubCommandValues(
      command,
      [],
      { foo: true },
    );
    expectExtractResult(result, { foo: true }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Positional types configured value is used for mandatory vararg with no arg provided", () => {
    let command: SubCommand = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.NUMBER,
        isVarargOptional: false,
        isVarargMultiple: true,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [],
      { foo: 1 },
    );
    expectExtractResult(result, { foo: 1 }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isVarargOptional: false,
        isVarargMultiple: true,
      }],
      execute: async (): Promise<void> => {
      },
    };
    result = populateSubCommandValues(
      command,
      [],
      { foo: "bar" },
    );
    expectExtractResult(result, { foo: "bar" }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.BOOLEAN,
        isVarargOptional: false,
        isVarargMultiple: true,
      }],
      execute: async (): Promise<void> => {
      },
    };
    result = populateSubCommandValues(
      command,
      [],
      { foo: true },
    );
    expectExtractResult(result, { foo: true }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option array configured single values completely overridden by multiple args", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isArray: true,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    const result = populateSubCommandValues(
      command,
      ["--foo", "bar1", "--foo", "bar2"],
      { foo: ["bar"] },
    );
    expectExtractResult(result, { foo: ["bar1", "bar2"] }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option array configured multiple values partially overridden by arg", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isArray: true,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    const result = populateSubCommandValues(
      command,
      ["--foo", "bar"],
      { foo: ["bar1", "bar2"] },
    );
    expectExtractResult(result, { foo: ["bar", "bar2"] }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Positional argument configured single value completely overridden by multiple args", () => {
    const command: SubCommand = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isVarargMultiple: true,
      }],
      execute: async (): Promise<void> => {
      },
    };

    const result = populateSubCommandValues(command, ["bar", "bar"], {
      foo: "bar1",
    });
    expectExtractResult(result, { foo: ["bar", "bar"] }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Positional argument configured multiple values partially overridden by single arg", () => {
    const command: SubCommand = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isVarargMultiple: true,
      }],
      execute: async (): Promise<void> => {
      },
    };

    const result = populateSubCommandValues(command, ["bar"], {
      foo: ["bar1", "bar2"],
    });
    expectExtractResult(result, { foo: ["bar", "bar2"] }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option array using indices", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        shortAlias: "f",
        isArray: true,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--foo[0]", "bar"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo[1]", "bar1", "--foo[0]", "bar0"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar0", "bar1"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo[0]=bar0", "--foo[1]", "bar1"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar0", "bar1"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo[1]=bar1", "-f[0]", "bar0"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar0", "bar1"] }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option array invalid indices", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        shortAlias: "f",
        isArray: true,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--foo[1]", "bar"],
      undefined,
    );
    let expected = {
      foo: [] as Array<string>,
    };
    expected.foo[1] = "bar";
    expectExtractResult(result, expected, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo[2]", "bar2", "--foo[0]", "bar0"],
      undefined,
    );
    expected = {
      foo: [] as Array<string>,
    };
    expected.foo[0] = "bar0";
    expected.foo[2] = "bar2";
    expectExtractResult(result, expected, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option array missing indices populated by configured defaults", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        shortAlias: "f",
        isArray: true,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--foo[1]", "bar"],
      { foo: ["car"] },
    );
    expectExtractResult(result, { foo: ["car", "bar"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo[2]", "bar1", "--foo[0]", "bar0"],
      { foo: ["bar", "car"] },
    );
    expectExtractResult(result, { foo: ["bar0", "car", "bar1"] }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option array using indices either side of positional", () => {
    let command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        isArray: true,
        type: ArgumentValueTypeName.STRING,
      }],
      positionals: [{
        name: "goo",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      [
        "--foo[0]",
        "f1",
        "goo1",
        "--foo[1]",
        "f2",
      ],
      undefined,
    );
    expectExtractResult(result, {
      foo: ["f1", "f2"],
      goo: "goo1",
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    command = {
      name: "command",
      options: [{
        name: "foo",
        isArray: true,
        type: ArgumentValueTypeName.BOOLEAN,
      }],
      positionals: [{
        name: "goo",
        type: ArgumentValueTypeName.STRING,
      }],
      execute: async (): Promise<void> => {
      },
    };
    result = populateSubCommandValues(
      command,
      [
        "--foo[1]",
        "true",
        "goo1",
        "--foo[0]",
        "false",
      ],
      undefined,
    );
    expectExtractResult(result, {
      foo: ["false", "true"],
      goo: "goo1",
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo[1]", "goo1", "--foo[0]"],
      undefined,
    );
    expectExtractResult(result, {
      foo: ["true", "true"],
      goo: "goo1",
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option complex values", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "alpha",
        type: ComplexValueTypeName.COMPLEX,
        shortAlias: "a",
        properties: [{
          name: "beta",
          type: ComplexValueTypeName.COMPLEX,
          shortAlias: "b",
          properties: [{
            name: "gamma",
            type: ArgumentValueTypeName.STRING,
            shortAlias: "g",
          }, {
            name: "delta",
            type: ArgumentValueTypeName.STRING,
            shortAlias: "d",
          }],
        }],
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--alpha.beta.gamma", "foo", "--alpha.beta.delta", "bar"],
      undefined,
    );
    expectExtractResult(result, {
      alpha: { beta: { gamma: "foo", delta: "bar" } },
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["-a.b.g", "foo", "-a.b.d", "bar"],
      undefined,
    );
    expectExtractResult(result, {
      alpha: { beta: { gamma: "foo", delta: "bar" } },
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option arrays of complex values and vice versa", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "alpha",
        type: ComplexValueTypeName.COMPLEX,
        shortAlias: "a",
        isArray: true,
        properties: [{
          name: "beta",
          type: ComplexValueTypeName.COMPLEX,
          shortAlias: "b",
          properties: [{
            name: "gamma",
            type: ArgumentValueTypeName.STRING,
            shortAlias: "g",
          }, {
            name: "delta",
            type: ArgumentValueTypeName.STRING,
            shortAlias: "d",
            isArray: true,
          }],
        }],
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--alpha.beta.gamma", "foo", "--alpha.beta.delta", "bar"],
      undefined,
    );
    expectExtractResult(result, {
      alpha: [{ beta: { gamma: "foo", delta: ["bar"] } }],
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["-a[0].b.d[0]", "bar"],
      undefined,
    );
    expectExtractResult(result, {
      alpha: [{ beta: { delta: ["bar"] } }],
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["-a[0].b.g", "foo", "-a[0].b.d[0]", "bar"],
      undefined,
    );
    expectExtractResult(result, {
      alpha: [{ beta: { gamma: "foo", delta: ["bar"] } }],
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      [
        "-a[0].b.g",
        "foo",
        "-a[0].b.d[0]",
        "bar",
        "-a[0].b.d[1]",
        "car",
        "-a[1].b.g",
        "foo",
        "-a[1].b.d[1]",
        "bar",
        "-a[1].b.d[0]",
        "car",
      ],
      undefined,
    );
    expectExtractResult(result, {
      alpha: [{ beta: { gamma: "foo", delta: ["bar", "car"] } }, {
        beta: { gamma: "foo", delta: ["car", "bar"] },
      }],
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option complex values with invalid properties", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "alpha",
        type: ComplexValueTypeName.COMPLEX,
        shortAlias: "a",
        properties: [{
          name: "beta",
          type: ComplexValueTypeName.COMPLEX,
          shortAlias: "b",
          properties: [{
            name: "gamma",
            type: ArgumentValueTypeName.STRING,
            shortAlias: "g",
          }, {
            name: "delta",
            type: ArgumentValueTypeName.STRING,
            shortAlias: "d",
          }],
        }],
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--alpha.beta.delta", "bar", "--alpha.beta.gamma"],
      undefined,
    );
    expectExtractResult(result, {
      alpha: { beta: { delta: "bar" } },
    }, []);
    expect(result.invalidArgument).toEqual({
      argument:
        ((command.options[0] as ComplexOption).properties[0] as ComplexOption)
          .properties[0],
      name: "--alpha.beta.gamma",
      reason: InvalidArgumentReason.MISSING_VALUE,
    });

    result = populateSubCommandValues(
      command,
      ["-a.b.g", "foo", "--alpha.beta.delta"],
      undefined,
    );
    expectExtractResult(result, {
      alpha: { beta: { gamma: "foo" } },
    }, []);
    expect(result.invalidArgument).toEqual({
      argument:
        ((command.options[0] as ComplexOption).properties[0] as ComplexOption)
          .properties[1],
      name: "--alpha.beta.delta",
      reason: InvalidArgumentReason.MISSING_VALUE,
    });

    result = populateSubCommandValues(
      command,
      ["-a.b.x", "foo"],
      undefined,
    );
    expectExtractResult(result, {
      alpha: { beta: {} },
    }, ["foo"]);
    expect(result.invalidArgument).toEqual({
      name: "-a.b.x",
      reason: InvalidArgumentReason.UNKNOWN_PROPERTY,
    });

    result = populateSubCommandValues(
      command,
      ["-a.b.g.a", "foo"],
      undefined,
    );
    expectExtractResult(result, {
      alpha: { beta: {} },
    }, ["foo"]);
    expect(result.invalidArgument).toEqual({
      name: "-a.b.g.a",
      reason: InvalidArgumentReason.UNKNOWN_PROPERTY,
    });
  });

  test("Option complex values with missing properties supplied by configured defaults", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "alpha",
        type: ComplexValueTypeName.COMPLEX,
        shortAlias: "a",
        properties: [{
          name: "beta",
          type: ComplexValueTypeName.COMPLEX,
          shortAlias: "b",
          properties: [{
            name: "gamma",
            type: ArgumentValueTypeName.STRING,
            shortAlias: "g",
          }, {
            name: "delta",
            type: ArgumentValueTypeName.STRING,
            shortAlias: "d",
          }],
        }],
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--alpha.beta.delta", "bar"],
      { alpha: { beta: { gamma: "foo" } } },
    );
    expectExtractResult(result, {
      alpha: { beta: { gamma: "foo", delta: "bar" } },
    }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["-a.b.g", "foo"],
      { alpha: { beta: { delta: "bar" } } },
    );
    expectExtractResult(result, {
      alpha: { beta: { gamma: "foo", delta: "bar" } },
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option array check for maximum array size", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isArray: true,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    const potentialArgs: Array<string> = [];
    for (let i = 0; i < 257; i++) {
      potentialArgs.push(`--foo=bar${i}`);
    }
    const values = { foo: [] as Array<string> };
    for (let i = 0; i < 255; i++) {
      values.foo.push(`bar${i}`);
    }

    let result = populateSubCommandValues(
      command,
      potentialArgs,
      undefined,
    );
    expectExtractResult(result, values, ["--foo=bar256"]);
    expect(result.invalidArgument).toEqual({
      argument: command.options[0],
      reason: InvalidArgumentReason.ARRAY_SIZE_EXCEEDED,
      name: "foo",
    });

    result = populateSubCommandValues(
      command,
      ["--foo[256]=bar"],
      undefined,
    );
    expectExtractResult(result, {}, []);
    expect(result.invalidArgument).toEqual({
      argument: command.options[0],
      reason: InvalidArgumentReason.ARRAY_SIZE_EXCEEDED,
      name: "foo",
    });

    result = populateSubCommandValues(
      command,
      ["--foo[256]", "bar"],
      undefined,
    );
    expectExtractResult(result, {}, ["bar"]);
    expect(result.invalidArgument).toEqual({
      argument: command.options[0],
      reason: InvalidArgumentReason.ARRAY_SIZE_EXCEEDED,
      name: "foo",
    });
  });

  test("Option array using mix of explicit and implicit indices", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        shortAlias: "f",
        isArray: true,
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    let result = populateSubCommandValues(
      command,
      ["--foo[0]", "bar0", "-f=bar1", "-f[2]=bar2"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar0", "bar1", "bar2"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo", "bar0", "--foo", "bar1", "--foo[2]=bar2"],
      undefined,
    );
    expectExtractResult(result, { foo: ["bar0", "bar1", "bar2"] }, []);
    expect(result.invalidArgument).toBeUndefined();

    result = populateSubCommandValues(
      command,
      ["--foo[2]", "bar2", "--foo", "bar3"],
      undefined,
    );

    const values = { foo: [] as Array<string | undefined> };
    values.foo[2] = "bar2";
    values.foo[3] = "bar3";

    expectExtractResult(result, values, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Positional varargs check for maximum array size", () => {
    const command: SubCommand = {
      name: "command",
      options: [],
      positionals: [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        isVarargMultiple: true,
      }],
      execute: async (): Promise<void> => {
      },
    };

    const potentialArgs: Array<string> = [];
    for (let i = 0; i < 257; i++) {
      potentialArgs.push(`bar${i}`);
    }
    const values = { foo: [] as Array<string> };
    for (let i = 0; i < 255; i++) {
      values.foo.push(`bar${i}`);
    }

    const result = populateSubCommandValues(
      command,
      potentialArgs,
      undefined,
    );
    expectExtractResult(result, values, ["bar256"]);
    expect(result.invalidArgument).toEqual({
      argument: command.positionals[0],
      reason: InvalidArgumentReason.ARRAY_SIZE_EXCEEDED,
      name: "foo",
    });
  });

  test("Option path invalid reference to complex option", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "alpha",
        type: ComplexValueTypeName.COMPLEX,
        shortAlias: "a",
        properties: [{
          name: "beta",
          type: ComplexValueTypeName.COMPLEX,
          shortAlias: "b",
          properties: [{
            name: "gamma",
            type: ArgumentValueTypeName.STRING,
            shortAlias: "g",
          }, {
            name: "delta",
            type: ArgumentValueTypeName.STRING,
            shortAlias: "d",
          }],
        }],
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    const result = populateSubCommandValues(
      command,
      ["--alpha.beta", "foo"],
      undefined,
    );
    expectExtractResult(result, {
      alpha: { beta: {} },
    }, ["foo"]);
    expect(result.invalidArgument).toEqual({
      argument: (command.options[0] as ComplexOption).properties[0],
      reason: InvalidArgumentReason.OPTION_IS_COMPLEX,
      name: "beta",
    });
  });

  test("Complex options with duplicated names and aliases ok if not siblings", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "alpha",
        type: ComplexValueTypeName.COMPLEX,
        shortAlias: "a",
        properties: [{
          name: "beta",
          type: ComplexValueTypeName.COMPLEX,
          shortAlias: "b",
          properties: [{
            name: "alpha",
            type: ArgumentValueTypeName.STRING,
            shortAlias: "a",
          }],
        }],
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    const result = populateSubCommandValues(
      command,
      ["-a.b.a", "foo"],
      undefined,
    );
    expectExtractResult(result, {
      alpha: { beta: { alpha: "foo" } },
    }, []);
    expect(result.invalidArgument).toBeUndefined();
  });

  test("Option path check for maximum nesting", () => {
    const command: SubCommand = {
      name: "command",
      options: [{
        name: "alpha",
        type: ComplexValueTypeName.COMPLEX,
        shortAlias: "a",
        properties: [{
          name: "beta",
          type: ComplexValueTypeName.COMPLEX,
          shortAlias: "b",
          properties: [{
            name: "gamma",
            type: ArgumentValueTypeName.STRING,
            shortAlias: "g",
          }],
        }],
      }],
      positionals: [],
      execute: async (): Promise<void> => {
      },
    };

    const result = populateSubCommandValues(
      command,
      ["-a.b.g.d.e.f.g.h.i.j.k", "foo"],
      undefined,
    );
    expectExtractResult(result, {}, ["foo"]);
    expect(result.invalidArgument).toEqual({
      reason: InvalidArgumentReason.NESTING_DEPTH_EXCEEDED,
      name: "-a.b.g.d.e.f.g.h.i.j.k",
    });
  });
});
