import { assertEquals, describe, it } from "../test_deps.ts";
import {
  InvalidArgumentReason,
  ParseResult,
  ScanResult,
} from "../../src/api/runtime/Parser.ts";
import {
  ArgumentValueType,
  ArgumentValueTypeName,
  ComplexOption,
  ComplexValueTypeName,
  GlobalCommand,
  GlobalModifierCommand,
  GroupCommand,
  PopulatedArgumentValues,
  SubCommand,
} from "../../mod.ts";
import DefaultParser from "../../src/runtime/DefaultParser.ts";
import DefaultCommandRegistry from "../../src/registry/DefaultCommandRegistry.ts";

function expectScanResult(result: ScanResult, expected: ScanResult) {
  assertEquals(result.unusedLeadingArgs, expected.unusedLeadingArgs);
  assertEquals(result.subCommandClause, expected.subCommandClause);
  assertEquals(result.globalCommandClause, expected.globalCommandClause);
  assertEquals(
    result.globalModifierCommandClauses,
    expected.globalModifierCommandClauses,
  );
}

function expectParseResult(result: ParseResult, expected: ParseResult) {
  assertEquals(
    result.populatedArgumentValues,
    expected.populatedArgumentValues,
  );
  assertEquals(result.unusedArgs, expected.unusedArgs);
  assertEquals(result.invalidArguments, expected.invalidArguments);
}

function getSubCommandWithComplexOptions(betaIsArray = false): SubCommand {
  return {
    name: "subCommand",
    options: [{
      name: "alpha",
      shortAlias: "a",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
      properties: [{
        name: "beta",
        shortAlias: "b",
        type: ComplexValueTypeName.COMPLEX,
        isArray: betaIsArray,
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
}

function getSubCommand(): SubCommand {
  return {
    name: "subCommand",
    options: [{
      name: "goo",
      shortAlias: "g",
      type: ArgumentValueTypeName.STRING,
    }],
    positionals: [{
      name: "foo",
      type: ArgumentValueTypeName.STRING,
    }],
    execute: async (): Promise<void> => {},
  };
}

function getGlobalCommand(): GlobalCommand {
  return {
    name: "globalCommand",
    shortAlias: "g",
    argument: {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    },
    execute: async (): Promise<void> => {},
  };
}

function getGlobalModifierCommand(
  name: string,
  shortAlias: string,
): GlobalModifierCommand {
  return {
    name,
    executePriority: 1,
    shortAlias,
    argument: {
      name: "value",
      type: ArgumentValueTypeName.STRING,
    },
    execute: async (): Promise<void> => {},
  };
}

function getGroupCommand(
  name: string,
  memberSubCommands: ReadonlyArray<SubCommand>,
): GroupCommand {
  return {
    name,
    memberSubCommands,
    execute: async (): Promise<void> => {},
  };
}

describe("DefaultParser", () => {
  it("Command not scanned if not added", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const commandRegistry = new DefaultCommandRegistry([]);

    let scanResult = defaultParser.scanForCommandClauses([
      "subCommand",
      "foo",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, {
      globalModifierCommandClauses: [],
      unusedLeadingArgs: ["subCommand", "foo", "--goo", "g"],
    });

    scanResult = defaultParser.scanForCommandClauses([
      "--command",
      "foo",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, {
      globalModifierCommandClauses: [],
      unusedLeadingArgs: ["--command", "foo", "--goo", "g"],
    });
  });

  it("Sub-command member not scanned if parent not specified", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const groupCommand = getGroupCommand("group", [getSubCommand()]);
    const commandRegistry = new DefaultCommandRegistry([groupCommand]);

    const scanResult = defaultParser.scanForCommandClauses([
      "subCommand",
      "foo",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, {
      globalModifierCommandClauses: [],
      unusedLeadingArgs: ["subCommand", "foo", "--goo", "g"],
    });
  });

  it("Global command scanned", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalCommand = getGlobalCommand();
    const commandRegistry = new DefaultCommandRegistry([globalCommand]);

    const expected: ScanResult = {
      globalCommandClause: {
        command: globalCommand,
        potentialArgs: ["g", "bar"],
      },
      globalModifierCommandClauses: [],
      unusedLeadingArgs: [],
    };

    let scanResult = defaultParser.scanForCommandClauses([
      "--globalCommand",
      "g",
      "bar",
    ], commandRegistry);
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses(
      ["--globalCommand=g", "bar"],
      commandRegistry,
    );
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses(
      ["-g", "g", "bar"],
      commandRegistry,
    );
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses(
      ["-g=g", "bar"],
      commandRegistry,
    );
    expectScanResult(scanResult, expected);
  });

  it("Global command normalising tricky 1", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalCommand = getGlobalCommand();
    const commandRegistry = new DefaultCommandRegistry([globalCommand]);

    const expected: ScanResult = {
      globalCommandClause: {
        command: globalCommand,
        potentialArgs: ["g=2", "bar=2"],
      },
      globalModifierCommandClauses: [],
      unusedLeadingArgs: [],
    };

    let scanResult = defaultParser.scanForCommandClauses([
      "--globalCommand",
      "g=2",
      "bar=2",
    ], commandRegistry);
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses([
      "--globalCommand=g=2",
      "bar=2",
    ], commandRegistry);
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses(
      ["-g", "g=2", "bar=2"],
      commandRegistry,
    );
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses(
      ["-g=g=2", "bar=2"],
      commandRegistry,
    );
    expectScanResult(scanResult, expected);
  });

  it("Global command normalising tricky 2", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalCommand = getGlobalCommand();
    const commandRegistry = new DefaultCommandRegistry([globalCommand]);

    const expected: ScanResult = {
      globalCommandClause: {
        command: globalCommand,
        potentialArgs: ["g="],
      },
      globalModifierCommandClauses: [],
      unusedLeadingArgs: [],
    };

    const scanResult = defaultParser.scanForCommandClauses([
      "--globalCommand",
      "g=",
    ], commandRegistry);
    expectScanResult(scanResult, expected);
  });

  it("Global modifier command scanned", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalModifierCommand = getGlobalModifierCommand("modifier", "m");
    const commandRegistry = new DefaultCommandRegistry([globalModifierCommand]);

    const expected: ScanResult = {
      globalModifierCommandClauses: [{
        command: globalModifierCommand,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: [],
    };

    let scanResult = defaultParser.scanForCommandClauses([
      "--modifier",
      "g",
      "bar",
    ], commandRegistry);
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses(
      ["--modifier=g", "bar"],
      commandRegistry,
    );
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses(
      ["-m", "g", "bar"],
      commandRegistry,
    );
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses(
      ["-m=g", "bar"],
      commandRegistry,
    );
    expectScanResult(scanResult, expected);
  });

  it("Two global modifier commands scanned", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalModifierCommand1 = getGlobalModifierCommand("modifier1", "1");
    const globalModifierCommand2 = getGlobalModifierCommand("modifier2", "2");
    const commandRegistry = new DefaultCommandRegistry([
      globalModifierCommand1,
      globalModifierCommand2,
    ]);

    const expected: ScanResult = {
      globalModifierCommandClauses: [{
        command: globalModifierCommand1,
        potentialArgs: ["g", "bar"],
      }, {
        command: globalModifierCommand2,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: [],
    };

    let scanResult = defaultParser.scanForCommandClauses([
      "--modifier1",
      "g",
      "bar",
      "--modifier2",
      "g",
      "bar",
    ], commandRegistry);
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses([
      "--modifier1=g",
      "bar",
      "--modifier2=g",
      "bar",
    ], commandRegistry);
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses([
      "-1",
      "g",
      "bar",
      "-2",
      "g",
      "bar",
    ], commandRegistry);
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses([
      "-1=g",
      "bar",
      "-2=g",
      "bar",
    ], commandRegistry);
    expectScanResult(scanResult, expected);
  });

  it("Sub-command scanned", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommand();
    const commandRegistry = new DefaultCommandRegistry([subCommand]);

    const scanResult = defaultParser.scanForCommandClauses([
      "subCommand",
      "bar",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, {
      subCommandClause: {
        command: subCommand,
        potentialArgs: ["bar", "--goo", "g"],
      },
      globalModifierCommandClauses: [],
      unusedLeadingArgs: [],
    });
  });

  it("Two sub-commands scanned (illegal scenario)", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommand();
    const commandRegistry = new DefaultCommandRegistry([subCommand]);

    const scanResult = defaultParser.scanForCommandClauses([
      "subCommand",
      "bar",
      "--goo",
      "g",
      "subCommand",
      "bar",
    ], commandRegistry);
    expectScanResult(scanResult, {
      subCommandClause: {
        command: subCommand,
        potentialArgs: ["bar", "--goo", "g", "subCommand", "bar"],
      },
      globalModifierCommandClauses: [],
      unusedLeadingArgs: [],
    });
  });

  it("Group command scanned", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommand();
    const groupCommand = getGroupCommand("group", [subCommand]);
    const commandRegistry = new DefaultCommandRegistry([groupCommand]);

    const expected: ScanResult = {
      subCommandClause: {
        groupCommand,
        command: subCommand,
        potentialArgs: ["bar", "--goo", "g"],
      },
      globalModifierCommandClauses: [],
      unusedLeadingArgs: [],
    };

    let scanResult = defaultParser.scanForCommandClauses([
      "group",
      "subCommand",
      "bar",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, expected);

    scanResult = defaultParser.scanForCommandClauses([
      "group:subCommand",
      "bar",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, expected);
  });

  it("Unknown group member command rejected", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommand();
    const groupCommand = getGroupCommand("group", [subCommand]);
    const commandRegistry = new DefaultCommandRegistry([groupCommand]);

    let scanResult = defaultParser.scanForCommandClauses([
      "group",
      "blah",
      "bar",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, {
      globalModifierCommandClauses: [],
      unusedLeadingArgs: ["group", "blah", "bar", "--goo", "g"],
    });

    scanResult = defaultParser.scanForCommandClauses([
      "group:blah",
      "bar",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, {
      globalModifierCommandClauses: [],
      unusedLeadingArgs: ["group:blah", "bar", "--goo", "g"],
    });
  });

  it("Two group commands scanned (illegal scenario)", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommand();
    const groupCommand1 = getGroupCommand("group1", [subCommand]);
    const groupCommand2 = getGroupCommand("group2", [subCommand]);
    const commandRegistry = new DefaultCommandRegistry([
      groupCommand1,
      groupCommand2,
    ]);

    let scanResult = defaultParser.scanForCommandClauses([
      "group1",
      "subCommand",
      "bar",
      "--goo",
      "g",
      "group2",
      "subCommand",
      "bar",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, {
      subCommandClause: {
        groupCommand: groupCommand1,
        command: subCommand,
        potentialArgs: [
          "bar",
          "--goo",
          "g",
          "group2",
          "subCommand",
          "bar",
          "--goo",
          "g",
        ],
      },
      globalModifierCommandClauses: [],
      unusedLeadingArgs: [],
    });

    scanResult = defaultParser.scanForCommandClauses([
      "group1",
      "subCommand",
      "bar",
      "--goo",
      "g",
      "group2:command",
      "bar",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, {
      subCommandClause: {
        groupCommand: groupCommand1,
        command: subCommand,
        potentialArgs: [
          "bar",
          "--goo",
          "g",
          "group2:command",
          "bar",
          "--goo",
          "g",
        ],
      },
      globalModifierCommandClauses: [],
      unusedLeadingArgs: [],
    });
  });

  it("Sub-command scanned and modifier and global command not scanned", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalModifierCommand = getGlobalModifierCommand("modifier", "m");
    const globalCommand = getGlobalCommand();
    const subCommand = getSubCommand();
    const commandRegistry = new DefaultCommandRegistry([
      globalModifierCommand,
      globalCommand,
      subCommand,
    ]);

    const scanResult = defaultParser.scanForCommandClauses([
      "subCommand",
      "bar",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, {
      subCommandClause: {
        command: subCommand,
        potentialArgs: ["bar", "--goo", "g"],
      },
      globalModifierCommandClauses: [],
      unusedLeadingArgs: [],
    });
  });

  it("Two global modifier commands and global command scanned", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalModifierCommand1 = getGlobalModifierCommand("modifier1", "1");
    const globalModifierCommand2 = getGlobalModifierCommand("modifier2", "2");
    const globalCommand = getGlobalCommand();
    const commandRegistry = new DefaultCommandRegistry([
      globalModifierCommand1,
      globalModifierCommand2,
      globalCommand,
    ]);

    let scanResult = defaultParser.scanForCommandClauses([
      "--modifier1",
      "g",
      "bar",
      "--modifier2",
      "g",
      "bar",
      "--globalCommand",
      "bar",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, {
      globalCommandClause: {
        command: globalCommand,
        potentialArgs: ["bar", "--goo", "g"],
      },
      globalModifierCommandClauses: [{
        command: globalModifierCommand1,
        potentialArgs: ["g", "bar"],
      }, {
        command: globalModifierCommand2,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: [],
    });

    scanResult = defaultParser.scanForCommandClauses([
      "-1",
      "g",
      "bar",
      "-2",
      "g",
      "bar",
      "-g",
      "bar",
      "--goo",
      "g",
    ], commandRegistry);
    expectScanResult(scanResult, {
      globalCommandClause: {
        command: globalCommand,
        potentialArgs: ["bar", "--goo", "g"],
      },
      globalModifierCommandClauses: [{
        command: globalModifierCommand1,
        potentialArgs: ["g", "bar"],
      }, {
        command: globalModifierCommand2,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: [],
    });

    scanResult = defaultParser.scanForCommandClauses([
      "-1=g",
      "bar",
      "-2=g",
      "bar",
      "-g=bar",
      "--goo=g",
    ], commandRegistry);
    expectScanResult(scanResult, {
      globalCommandClause: {
        command: globalCommand,
        potentialArgs: ["bar", "--goo=g"],
      },
      globalModifierCommandClauses: [{
        command: globalModifierCommand1,
        potentialArgs: ["g", "bar"],
      }, {
        command: globalModifierCommand2,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: [],
    });
  });

  it("Two global modifier commands and global command scanned out of order", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalModifierCommand1 = getGlobalModifierCommand("modifier1", "1");
    const globalModifierCommand2 = getGlobalModifierCommand("modifier2", "2");
    const globalCommand = getGlobalCommand();
    const commandRegistry = new DefaultCommandRegistry([
      globalModifierCommand1,
      globalModifierCommand2,
      globalCommand,
    ]);

    const scanResult = defaultParser.scanForCommandClauses([
      "--modifier1",
      "g",
      "bar",
      "--globalCommand",
      "bar",
      "--goo",
      "g",
      "--modifier2",
      "g",
      "bar",
    ], commandRegistry);

    expectScanResult(scanResult, {
      globalCommandClause: {
        command: globalCommand,
        potentialArgs: ["bar", "--goo", "g"],
      },
      globalModifierCommandClauses: [{
        command: globalModifierCommand1,
        potentialArgs: ["g", "bar"],
      }, {
        command: globalModifierCommand2,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: [],
    });
  });

  it("Two global modifier commands and group command scanned out of order", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalModifierCommand1 = getGlobalModifierCommand("modifier1", "1");
    const globalModifierCommand2 = getGlobalModifierCommand("modifier2", "2");
    const subCommand = getSubCommand();
    const groupCommand = getGroupCommand("group", [subCommand]);
    const commandRegistry = new DefaultCommandRegistry([
      globalModifierCommand1,
      globalModifierCommand2,
      groupCommand,
    ]);

    const scanResult = defaultParser.scanForCommandClauses([
      "--modifier1",
      "g",
      "bar",
      "group:subCommand",
      "bar",
      "--goo",
      "g",
      "--modifier2",
      "g",
      "bar",
    ], commandRegistry);

    expectScanResult(scanResult, {
      subCommandClause: {
        groupCommand,
        command: subCommand,
        potentialArgs: ["bar", "--goo", "g"],
      },
      globalModifierCommandClauses: [{
        command: globalModifierCommand1,
        potentialArgs: ["g", "bar"],
      }, {
        command: globalModifierCommand2,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: [],
    });
  });

  it("Global modifier command and sub-command scanned", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalModifierCommand = getGlobalModifierCommand("modifier", "1");
    const subCommand = getSubCommand();
    const commandRegistry = new DefaultCommandRegistry([
      globalModifierCommand,
      subCommand,
    ]);

    const scanResult = defaultParser.scanForCommandClauses([
      "--modifier",
      "g",
      "bar",
      "subCommand",
      "bar",
      "--goo",
      "g",
    ], commandRegistry);

    expectScanResult(scanResult, {
      subCommandClause: {
        command: subCommand,
        potentialArgs: ["bar", "--goo", "g"],
      },
      globalModifierCommandClauses: [{
        command: globalModifierCommand,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: [],
    });
  });

  it("Two global modifier commands, global command and sub-command scanned (illegal scenario)", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalModifierCommand1 = getGlobalModifierCommand("modifier1", "1");
    const globalModifierCommand2 = getGlobalModifierCommand("modifier2", "2");
    const globalCommand = getGlobalCommand();
    const subCommand = getSubCommand();
    const commandRegistry = new DefaultCommandRegistry([
      globalModifierCommand1,
      globalModifierCommand2,
      globalCommand,
      subCommand,
    ]);

    let scanResult = defaultParser.scanForCommandClauses([
      "subCommand",
      "bar",
      "--goo",
      "g",
      "--modifier1",
      "g",
      "bar",
      "--globalCommand",
      "bar",
      "--goo",
      "g",
      "--modifier2",
      "g",
      "bar",
    ], commandRegistry);
    expectScanResult(scanResult, {
      subCommandClause: {
        command: subCommand,
        potentialArgs: ["bar", "--goo", "g"],
      },
      globalModifierCommandClauses: [{
        command: globalModifierCommand1,
        potentialArgs: ["g", "bar", "--globalCommand", "bar", "--goo", "g"],
      }, {
        command: globalModifierCommand2,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: [],
    });

    scanResult = defaultParser.scanForCommandClauses([
      "subCommand",
      "bar",
      "--goo=g",
      "-1=g",
      "bar",
      "-g=bar",
      "--goo",
      "g",
      "-2=g",
      "bar",
    ], commandRegistry);
    expectScanResult(scanResult, {
      subCommandClause: {
        command: subCommand,
        potentialArgs: ["bar", "--goo=g"],
      },
      globalModifierCommandClauses: [{
        command: globalModifierCommand1,
        potentialArgs: ["g", "bar", "-g=bar", "--goo", "g"],
      }, {
        command: globalModifierCommand2,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: [],
    });
  });

  it("Two global modifier commands, group command and sub-command scanned (illegal scenario)", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalModifierCommand1 = getGlobalModifierCommand("modifier1", "1");
    const globalModifierCommand2 = getGlobalModifierCommand("modifier2", "2");
    const subCommand = getSubCommand();
    const groupCommand = getGroupCommand("group", [subCommand]);
    const commandRegistry = new DefaultCommandRegistry([
      globalModifierCommand1,
      globalModifierCommand2,
      groupCommand,
      subCommand,
    ]);

    const scanResult = defaultParser.scanForCommandClauses([
      "subCommand",
      "bar",
      "--goo",
      "g",
      "--modifier1",
      "g",
      "bar",
      "group:command",
      "bar",
      "--goo",
      "g",
      "--modifier2",
      "g",
      "bar",
    ], commandRegistry);
    expectScanResult(scanResult, {
      subCommandClause: {
        command: subCommand,
        potentialArgs: ["bar", "--goo", "g"],
      },
      globalModifierCommandClauses: [{
        command: globalModifierCommand1,
        potentialArgs: ["g", "bar", "group:command", "bar", "--goo", "g"],
      }, {
        command: globalModifierCommand2,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: [],
    });
  });

  it("Unused leading args whilst scanning", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalModifierCommand = getGlobalModifierCommand("modifier", "m");
    const globalCommand = getGlobalCommand();
    const subCommand = getSubCommand();
    const commandRegistry = new DefaultCommandRegistry([
      globalModifierCommand,
      globalCommand,
      subCommand,
    ]);

    let scanResult = defaultParser.scanForCommandClauses([
      "hello",
      "--world",
      "subCommand",
      "bar",
      "--goo",
      "g",
      "--modifier",
      "g",
      "bar",
    ], commandRegistry);
    expectScanResult(scanResult, {
      subCommandClause: {
        command: subCommand,
        potentialArgs: ["bar", "--goo", "g"],
      },
      globalModifierCommandClauses: [{
        command: globalModifierCommand,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: ["hello", "--world"],
    });

    scanResult = defaultParser.scanForCommandClauses([
      "hello",
      "--world",
      "--globalCommand",
      "bar",
      "--goo",
      "g",
      "--modifier",
      "g",
      "bar",
    ], commandRegistry);
    expectScanResult(scanResult, {
      globalCommandClause: {
        command: globalCommand,
        potentialArgs: ["bar", "--goo", "g"],
      },
      globalModifierCommandClauses: [{
        command: globalModifierCommand,
        potentialArgs: ["g", "bar"],
      }],
      unusedLeadingArgs: ["hello", "--world"],
    });
  });

  it("Arguments parsed for sub-command", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommand();

    let parseResult = defaultParser.parseSubCommandClause({
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

    parseResult = defaultParser.parseSubCommandClause({
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

  it("Arguments parsed for global command", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalCommand = getGlobalCommand();

    const parseResult = defaultParser.parseGlobalCommandClause({
      command: globalCommand,
      potentialArgs: ["foo"],
    });
    expectParseResult(parseResult, {
      command: globalCommand,
      populatedArgumentValues: {
        globalCommand: "foo",
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  it("Arguments parsed for global modifier command", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const globalModifierCommand = getGlobalModifierCommand(
      "modifierCommand",
      "m",
    );

    const parseResult = defaultParser.parseGlobalCommandClause({
      command: globalModifierCommand,
      potentialArgs: ["foo"],
    });
    expectParseResult(parseResult, {
      command: globalModifierCommand,
      populatedArgumentValues: {
        modifierCommand: "foo",
      },
      unusedArgs: [],
      invalidArguments: [],
    });
  });

  it("Arguments parsed with trailing args", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommand();

    const parseResult = defaultParser.parseSubCommandClause({
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

  it("All arguments provided in config", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommand();

    const parseResult = defaultParser.parseSubCommandClause({
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

  it("Some arguments provided in config", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommand();

    let parseResult = defaultParser.parseSubCommandClause({
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

    parseResult = defaultParser.parseSubCommandClause({
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

  it("Extra config provided", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommand();

    const parseResult = defaultParser.parseSubCommandClause({
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

  it("Sub-command with complex options scanned", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommandWithComplexOptions();
    const commandRegistry = new DefaultCommandRegistry([subCommand]);

    let scanResult = defaultParser.scanForCommandClauses([
      "subCommand",
      "-a.b.g=foo1",
      "-a.b.d=1",
      "-a.b.g=foo2",
      "-a.b.d=2",
      "-a.b.d=3",
      "-e.g=bar",
      "-e.d=1",
    ], commandRegistry);
    expectScanResult(scanResult, {
      subCommandClause: {
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
      },
      globalModifierCommandClauses: [],
      unusedLeadingArgs: [],
    });
    scanResult = defaultParser.scanForCommandClauses([
      "subCommand",
      "--alpha.beta.gamma=foo1",
      "-a.b.d=1",
      "-a.b.g=foo2",
      "-a.b.d=2",
      "-a.b.d=3",
      "-e.g=bar",
      "-e.d=1",
    ], commandRegistry);
    expectScanResult(scanResult, {
      subCommandClause: {
        command: subCommand,
        potentialArgs: [
          "--alpha.beta.gamma=foo1",
          "-a.b.d=1",
          "-a.b.g=foo2",
          "-a.b.d=2",
          "-a.b.d=3",
          "-e.g=bar",
          "-e.d=1",
        ],
      },
      globalModifierCommandClauses: [],
      unusedLeadingArgs: [],
    });
    scanResult = defaultParser.scanForCommandClauses([
      "subCommand",
      "-e.g=bar",
      "-e.d=1",
      "-a.b[1].g=foo2",
      "--alpha.beta[0].gamma=foo1",
      "-a.b[1].d[1]=2",
      "-a.b[0].d=1",
      "-a.b[1].d[0]=3",
    ], commandRegistry);
    expectScanResult(scanResult, {
      subCommandClause: {
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
      },
      globalModifierCommandClauses: [],
      unusedLeadingArgs: [],
    });
  });

  it("Arguments parsed for sub-command with complex options", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommandWithComplexOptions(true);

    const parseResult = defaultParser.parseSubCommandClause({
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

  it("Arguments parsed for sub-command with complex options (illegal scenarios)", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommandWithComplexOptions();

    let parseResult = defaultParser.parseSubCommandClause({
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

    parseResult = defaultParser.parseSubCommandClause({
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

  it("Arguments parsed for sub-command with complex options and sparse array", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommandWithComplexOptions(true);

    let parseResult = defaultParser.parseSubCommandClause({
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

    parseResult = defaultParser.parseSubCommandClause({
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

  it("Arguments parsed for sub-command with complex options and missing property values", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommandWithComplexOptions(false);

    const parseResult = defaultParser.parseSubCommandClause({
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

  it("Arguments parsed for sub-command with complex options and some values provided by config", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommandWithComplexOptions(true);

    const parseResult = defaultParser.parseSubCommandClause({
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

  it("Arguments parsed for sub-command with complex options and some values provided by config but overridden", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommandWithComplexOptions(true);

    const parseResult = defaultParser.parseSubCommandClause({
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

  it("Arguments parsed for sub-command with complex options and all values provided by config", () => {
    const defaultParser: DefaultParser = new DefaultParser();
    const subCommand = getSubCommandWithComplexOptions(true);

    const parseResult = defaultParser.parseSubCommandClause({
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

  it("Arguments parsed for sub-command with complex options and all values provided by default value", () => {
    const defaultParser: DefaultParser = new DefaultParser();
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

    const parseResult = defaultParser.parseSubCommandClause({
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
