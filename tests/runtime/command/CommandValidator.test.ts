import { describe, expect, test } from "bun:test";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import CommandValidator from "../../../src/runtime/command/CommandValidator.ts";
import {
  getGlobalCommandWithShortAlias,
  getGroupCommand,
  getSubCommandWithComplexOptions,
} from "../../fixtures/Command.ts";
import type ComplexOption from "../../../src/api/argument/ComplexOption.ts";
import {
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "../../../src/api/argument/ArgumentValueTypes.ts";
import type Option from "../../../src/api/argument/Option.ts";
import type Positional from "../../../src/api/argument/Positional.ts";
import type SubCommand from "../../../src/api/command/SubCommand.ts";

function getSubCommand(
  name: string,
  options: ReadonlyArray<Option | ComplexOption>,
  positionals: ReadonlyArray<Positional>,
  enableConfiguration = false,
): SubCommand {
  return {
    name,
    options,
    positionals,
    enableConfiguration,
    execute: async (): Promise<void> => {},
  };
}
describe("CommandValidator tests", () => {
  test("SubCommand validation fails due to duplicate argument names", () => {
    let command = getSubCommand("command", [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }], []);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();

    command = getSubCommand("command", [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }], [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }]);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
    command = getSubCommand("command", [], [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }]);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test("SubCommand validation fails due to duplicate argument names or short aliases", () => {
    let command = getSubCommand("command", [{
      name: "f",
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "foo",
      shortAlias: "f",
      type: ArgumentValueTypeName.STRING,
    }], []);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
    command = getSubCommand("command", [{
      name: "foo1",
      shortAlias: "f",
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "foo2",
      shortAlias: "f",
      type: ArgumentValueTypeName.STRING,
    }], []);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test(
    "SubCommand validation fails due to option default value" +
      " not matching any values specified in argument valid values",
    () => {
      const command = getSubCommand("command", [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        defaultValue: "bar",
        allowableValues: ["goo"],
      }], []);

      expect(() => new CommandValidator(getCLIConfig()).validate(command))
        .toThrow();
    },
  );

  test(
    "SubCommand validation fails due to the type of option defaultValue" +
      " not matching the type specified in argument type",
    () => {
      const command = getSubCommand("command", [{
        name: "foo",
        defaultValue: "bar",
        type: ArgumentValueTypeName.BOOLEAN,
      }], []);

      expect(() => new CommandValidator(getCLIConfig()).validate(command))
        .toThrow();
    },
  );

  test(
    "SubCommand validation fails due to option defaultValue" +
      " being an array and option does not support array",
    () => {
      const command = getSubCommand("command", [{
        name: "foo",
        defaultValue: ["bar1", "bar2"],
        type: ArgumentValueTypeName.STRING,
      }], []);

      expect(() => new CommandValidator(getCLIConfig()).validate(command))
        .toThrow();
    },
  );

  test(
    "SubCommand validation fails due to the type of values in argument" +
      " allowableValues not matching the type specified in argument type",
    () => {
      const command = getSubCommand("command", [{
        name: "foo",
        defaultValue: "bar",
        allowableValues: [1],
        type: ArgumentValueTypeName.STRING,
      }], []);

      expect(() => new CommandValidator(getCLIConfig()).validate(command))
        .toThrow();
    },
  );

  test("SubCommand validation fails due to invalid command name", () => {
    const command = getSubCommand("command", [{
      name: "-foo",
      type: ArgumentValueTypeName.STRING,
    }], []);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test("SubCommand validation fails due to invalid command short alias", () => {
    const command = getSubCommand("command", [{
      name: "foo",
      shortAlias: "foo",
      type: ArgumentValueTypeName.STRING,
    }], []);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test("SubCommand validation fails due to non-last positional being varargs", () => {
    let command = getSubCommand("command", [], [{
      name: "foo",
      isVarargMultiple: true,
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "goo",
      type: ArgumentValueTypeName.STRING,
    }]);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
    command = getSubCommand("command", [], [{
      name: "foo",
      isVarargOptional: true,
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "goo",
      type: ArgumentValueTypeName.STRING,
    }]);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test("SubCommand validation fails due to more than one positional being varargs", () => {
    let command = getSubCommand("command", [], [{
      name: "foo",
      isVarargMultiple: true,
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "goo",
      isVarargMultiple: true,
      type: ArgumentValueTypeName.STRING,
    }]);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
    command = getSubCommand("command", [], [{
      name: "foo",
      isVarargOptional: true,
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "goo",
      isVarargOptional: true,
      type: ArgumentValueTypeName.STRING,
    }]);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
    command = getSubCommand("command", [], [{
      name: "foo",
      isVarargOptional: true,
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "goo",
      isVarargMultiple: true,
      type: ArgumentValueTypeName.STRING,
    }]);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
    command = getSubCommand("command", [], [{
      name: "foo",
      isVarargMultiple: true,
      type: ArgumentValueTypeName.STRING,
    }, {
      name: "goo",
      isVarargOptional: true,
      type: ArgumentValueTypeName.STRING,
    }]);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test("SubCommand validation succeeds", () => {
    const command = getSubCommand("command", [{
      name: "foo",
      defaultValue: "bar",
      allowableValues: ["bar", "gar"],
      shortAlias: "f",
      type: ArgumentValueTypeName.STRING,
    }], [{
      name: "boo",
      type: ArgumentValueTypeName.NUMBER,
      isVarargMultiple: true,
      allowableValues: [1, 2],
    }]);

    new CommandValidator(getCLIConfig()).validate(command);
  });

  test(
    "GlobalCommand validation fails due to the default value" +
      " not matching any values specified in argument valid values",
    () => {
      const command = getGlobalCommandWithShortAlias("command", "c", {
        type: ArgumentValueTypeName.STRING,
        defaultValue: "bar",
        allowableValues: ["goo"],
      });

      expect(() => new CommandValidator(getCLIConfig()).validate(command))
        .toThrow();
    },
  );

  test(
    "GlobalCommand validation fails due to the type of defaultValue" +
      " not matching the type specified in global argument type",
    () => {
      const command = getGlobalCommandWithShortAlias("command", "c", {
        type: ArgumentValueTypeName.BOOLEAN,
        defaultValue: "bar",
      });

      expect(() => new CommandValidator(getCLIConfig()).validate(command))
        .toThrow();
    },
  );

  test(
    "GlobalCommand validation fails due to the type of values in argument" +
      " allowableValues not matching the type specified in argument type",
    () => {
      const command = getGlobalCommandWithShortAlias("command", "c", {
        defaultValue: "bar",
        allowableValues: [1],
        type: ArgumentValueTypeName.STRING,
      });

      expect(() => new CommandValidator(getCLIConfig()).validate(command))
        .toThrow();
    },
  );

  test("GlobalCommand validation fails due to invalid command name", () => {
    const command = getGlobalCommandWithShortAlias("-command", "c", {
      type: ArgumentValueTypeName.STRING,
    });

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test("GlobalCommand validation fails due to invalid command short alias", () => {
    const command = getGlobalCommandWithShortAlias("command", "command", {
      type: ArgumentValueTypeName.STRING,
    });

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test("GlobalCommand validation succeeds with global argument", () => {
    const command = getGlobalCommandWithShortAlias("command", "c", {
      defaultValue: "bar",
      allowableValues: ["bar", "gar"],
      type: ArgumentValueTypeName.STRING,
    });

    new CommandValidator(getCLIConfig()).validate(command);
  });

  test("GlobalCommand validation succeeds without global argument", () => {
    const command = getGlobalCommandWithShortAlias("command", "c");

    new CommandValidator(getCLIConfig()).validate(command);
  });

  test("GrouoCommand validation fails due to name and member duplicate names", () => {
    const command = getGroupCommand("command", [
      getSubCommand("command", [], []),
    ]);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test("GrouoCommand validation fails due to duplicate member command names", () => {
    const command = getGroupCommand("group", [
      getSubCommand("command", [], []),
      getSubCommand("command", [], []),
    ]);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test("GrouoCommand validation fails due to invalid command name", () => {
    const command = getGroupCommand("-group", [
      getSubCommand("command", [], []),
    ]);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test("GroupCommand validation succeeds", () => {
    const command = getGroupCommand("group", [
      getSubCommand("command1", [], []),
      getSubCommand("command2", [{
        name: "foo",
        defaultValue: "bar",
        allowableValues: ["bar", "gar"],
        shortAlias: "f",
        type: ArgumentValueTypeName.STRING,
      }], [{
        name: "boo",
        type: ArgumentValueTypeName.NUMBER,
        isVarargMultiple: true,
        allowableValues: [1, 2],
      }]),
    ]);

    new CommandValidator(getCLIConfig()).validate(command);
  });

  test("SubCommand validation succeeds", () => {
    new CommandValidator(getCLIConfig()).validate(
      getSubCommandWithComplexOptions(true),
    );
  });

  test("SubCommand validation fails due to nested duplicate property paths", () => {
    const command = getSubCommand("command", [{
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
        }],
      }],
    }, {
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
        }],
      }],
    }], []);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test("SubCommand validation fails due to duplicate argument names or short aliases in sibling nested properties", () => {
    const command = getSubCommand("command", [{
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
        }],
      }],
    }, {
      name: "a",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
      properties: [{
        name: "b",
        type: ComplexValueTypeName.COMPLEX,
        isArray: true,
        properties: [{
          name: "g",
          type: ArgumentValueTypeName.STRING,
        }],
      }],
    }], []);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
  });

  test(
    "SubCommand validation fails due to nested property option default value" +
      " not matching any values specified in argument valid values",
    () => {
      let command = getSubCommand("command", [{
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
            allowableValues: ["foo"],
            defaultValue: "bar",
          }],
        }],
      }], []);

      expect(() => new CommandValidator(getCLIConfig()).validate(command))
        .toThrow();

      command = getSubCommand("command", [{
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
            allowableValues: ["foo", "bar"],
            defaultValue: "bar",
          }],
        }],
      }], []);
      new CommandValidator(getCLIConfig()).validate(command);
    },
  );

  test(
    "SubCommand validation fails due to the type of nested property complex option defaultValue" +
      " not matching the type specified in argument type",
    () => {
      const command = getSubCommand("command", [{
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
            type: ArgumentValueTypeName.BOOLEAN,
            defaultValue: 1,
          }],
        }],
      }], []);

      expect(() => new CommandValidator(getCLIConfig()).validate(command))
        .toThrow();
    },
  );

  test(
    "SubCommand validation fails due to nested property complex option defaultValue" +
      " being an array and option does not support array",
    () => {
      const command = getSubCommand("command", [{
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
            defaultValue: ["foo", "bar"],
          }],
        }],
      }], []);

      expect(() => new CommandValidator(getCLIConfig()).validate(command))
        .toThrow();
    },
  );

  test(
    "SubCommand validation fails due to the type of nested property values in complex option" +
      " allowableValues not matching the type specified in argument type",
    () => {
      let command = getSubCommand("command", [{
        name: "alpha",
        type: ComplexValueTypeName.COMPLEX,
        isArray: true,
        defaultValue: [
          {
            beta: 1,
          },
        ],
        properties: [{
          name: "beta",
          type: ComplexValueTypeName.COMPLEX,
          properties: [{
            name: "gamma",
            type: ArgumentValueTypeName.BOOLEAN,
          }],
        }],
      }], []);

      expect(() => new CommandValidator(getCLIConfig()).validate(command))
        .toThrow();

      command = getSubCommand("command", [{
        name: "alpha",
        type: ComplexValueTypeName.COMPLEX,
        isArray: true,
        defaultValue: [
          {
            beta: {
              gamma: 1,
            },
          },
        ],
        properties: [{
          name: "beta",
          type: ComplexValueTypeName.COMPLEX,
          properties: [{
            name: "gamma",
            type: ArgumentValueTypeName.BOOLEAN,
          }],
        }],
      }], []);

      expect(() => new CommandValidator(getCLIConfig()).validate(command))
        .toThrow();

      command = getSubCommand("command", [{
        name: "alpha",
        type: ComplexValueTypeName.COMPLEX,
        isArray: true,
        defaultValue: [
          {
            beta: {
              gamma: "foo",
            },
          },
        ],
        properties: [{
          name: "beta",
          type: ComplexValueTypeName.COMPLEX,
          properties: [{
            name: "gamma",
            type: ArgumentValueTypeName.STRING,
          }],
        }],
      }], []);

      new CommandValidator(getCLIConfig()).validate(command);
    },
  );

  test("SubCommand validation fails due to invalid complex option property name", () => {
    let command = getSubCommand("command", [{
      name: "alpha",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
      properties: [{
        name: "-beta",
        type: ComplexValueTypeName.COMPLEX,
        properties: [{
          name: "gamma",
          type: ArgumentValueTypeName.STRING,
        }],
      }],
    }], []);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();
    command = getSubCommand("command", [{
      name: "alpha",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
      properties: [{
        name: "beta",
        type: ComplexValueTypeName.COMPLEX,
        properties: [{
          name: "gamma",
          type: ArgumentValueTypeName.STRING,
        }],
      }],
    }], []);

    new CommandValidator(getCLIConfig()).validate(command);
  });

  test("SubCommand validation fails due to invalid complex option property short alias", () => {
    let command = getSubCommand("command", [{
      name: "alpha",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
      properties: [{
        name: "beta",
        shortAlias: "-",
        type: ComplexValueTypeName.COMPLEX,
        properties: [{
          name: "gamma",
          type: ArgumentValueTypeName.STRING,
        }],
      }],
    }], []);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrow();

    command = getSubCommand("command", [{
      name: "alpha",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
      properties: [{
        name: "beta",
        shortAlias: "b",
        type: ComplexValueTypeName.COMPLEX,
        properties: [{
          name: "gamma",
          type: ArgumentValueTypeName.STRING,
        }],
      }],
    }], []);

    new CommandValidator(getCLIConfig()).validate(command);
  });

  test("SubCommand validation fails due to custom configuration key when not enabled", () => {
    let command = getSubCommand("command", [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
      configurationKey: "FOO_BAR",
    }], []);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrowError(
        "Command: 'command' enableConfiguration is false, but an argument defines a configurationKey: 'FOO_BAR'",
      );

    command = getSubCommand(
      "command",
      [{
        name: "foo",
        type: ArgumentValueTypeName.STRING,
        configurationKey: "FOO_BAR",
      }],
      [],
      true,
    );

    new CommandValidator(getCLIConfig()).validate(command);
  });

  test("SubCommand validation fails due to duplicate custom configuration key", () => {
    let command = getSubCommand("command", [{
      name: "foo1",
      type: ArgumentValueTypeName.STRING,
      configurationKey: "FOO_BAR",
    }], [{
      name: "foo2",
      type: ArgumentValueTypeName.STRING,
      configurationKey: "FOO_BAR",
    }], true);

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrowError(
        "Command: 'command' contains arguments with the same configuration key: 'FOO_BAR'",
      );

    command = getSubCommand("command", [{
      name: "foo1",
      type: ArgumentValueTypeName.STRING,
      configurationKey: "FOO_BAR_1",
    }], [{
      name: "foo2",
      type: ArgumentValueTypeName.STRING,
      configurationKey: "FOO_BAR_2",
    }], true);

    new CommandValidator(getCLIConfig()).validate(command);
  });

  test("SubCommand validation fails due to invalid configuration key", () => {
    let command = getSubCommand(
      "command",
      [{
        name: "foo1",
        type: ArgumentValueTypeName.STRING,
        configurationKey: "-FOO_BAR",
      }],
      [],
      true,
    );

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrowError(
        "Illegal configuration key: '-FOO_BAR'",
      );

    command = getSubCommand(
      "command",
      [{
        name: "foo1",
        type: ArgumentValueTypeName.STRING,
        configurationKey: "3_FOO_BAR_1",
      }],
      [],
      true,
    );

    expect(() => new CommandValidator(getCLIConfig()).validate(command))
      .toThrowError(
        "Illegal configuration key: '3_FOO_BAR_1'",
      );
  });
});
