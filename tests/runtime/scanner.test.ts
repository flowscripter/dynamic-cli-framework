import { assertEquals } from "@std/assert";
import {
  getGlobalCommandWithShortAlias,
  getGlobalModifierCommand,
  getGroupCommand,
  getSubCommandWithComplexOptions,
  getSubCommandWithOptionAndPositional,
} from "../fixtures/Command.ts";
import {
  scanForGlobalModifierCommandClauses,
  scanForNonModifierCommandClause,
  type ScanResult,
} from "../../src/runtime/scanner.ts";
import type GlobalModifierCommand from "../../src/api/command/GlobalModifierCommand.ts";
import type GroupCommand from "../../src/api/command/GroupCommand.ts";
import type SubCommand from "../../src/api/command/SubCommand.ts";
import type GlobalCommand from "../../src/api/command/GlobalCommand.ts";
import type Command from "../../src/api/command/Command.ts";

function expectScanResult(result: ScanResult, expected: ScanResult) {
  assertEquals(result.unusedArgSequences, expected.unusedArgSequences);
  assertEquals(
    result.nonModifierCommandClause,
    expected.nonModifierCommandClause,
  );
  assertEquals(
    result.globalModifierCommandClauses,
    expected.globalModifierCommandClauses,
  );
}

Deno.test("Global modifier command scanned", () => {
  const globalModifierCommand = getGlobalModifierCommand(
    "modifier",
    "m",
    true,
    true,
  );
  const globalModifierCommandsByName: ReadonlyMap<
    string,
    GlobalModifierCommand
  > = new Map([[globalModifierCommand.name, globalModifierCommand]]);
  const globalModifierCommandsByShortAlias: ReadonlyMap<
    string,
    GlobalModifierCommand
  > = new Map([[globalModifierCommand.shortAlias!, globalModifierCommand]]);

  const expected: ScanResult = {
    globalModifierCommandClauses: [{
      command: globalModifierCommand,
      potentialArgs: ["g", "bar"],
    }],
    unusedArgSequences: [],
  };

  let scanResult = scanForGlobalModifierCommandClauses(
    [[
      "--modifier",
      "g",
      "bar",
    ]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForGlobalModifierCommandClauses(
    [["--modifier=g", "bar"]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForGlobalModifierCommandClauses(
    [["-m", "g", "bar"]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForGlobalModifierCommandClauses(
    [["-m=g", "bar"]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForGlobalModifierCommandClauses(
    [[], [
      "--modifier",
      "g",
      "bar",
    ]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForGlobalModifierCommandClauses(
    [[
      "--modifier",
      "g",
      "bar",
    ], []],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);
});

Deno.test("Two global modifier commands scanned", () => {
  const globalModifierCommand1 = getGlobalModifierCommand(
    "modifier1",
    "1",
    true,
    true,
  );
  const globalModifierCommand2 = getGlobalModifierCommand(
    "modifier2",
    "2",
    true,
    true,
  );
  const globalModifierCommandsByName: ReadonlyMap<
    string,
    GlobalModifierCommand
  > = new Map([
    [globalModifierCommand1.name, globalModifierCommand1],
    [globalModifierCommand2.name, globalModifierCommand2],
  ]);
  const globalModifierCommandsByShortAlias: ReadonlyMap<
    string,
    GlobalModifierCommand
  > = new Map([
    [globalModifierCommand1.shortAlias!, globalModifierCommand1],
    [globalModifierCommand2.shortAlias!, globalModifierCommand2],
  ]);

  let expected: ScanResult = {
    globalModifierCommandClauses: [{
      command: globalModifierCommand1,
      potentialArgs: ["g", "bar"],
    }, {
      command: globalModifierCommand2,
      potentialArgs: ["g", "bar"],
    }],
    unusedArgSequences: [],
  };

  let scanResult = scanForGlobalModifierCommandClauses(
    [[
      "--modifier1",
      "g",
      "bar",
      "--modifier2",
      "g",
      "bar",
    ]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForGlobalModifierCommandClauses(
    [[
      "--modifier1=g",
      "bar",
      "--modifier2=g",
      "bar",
    ]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForGlobalModifierCommandClauses(
    [[
      "-1",
      "g",
      "bar",
      "-2",
      "g",
      "bar",
    ]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForGlobalModifierCommandClauses(
    [[
      "-1=g",
      "bar",
      "-2=g",
      "bar",
    ]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForGlobalModifierCommandClauses(
    [[], [
      "-1=g",
      "bar",
      "-2=g",
      "bar",
    ]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  expected = {
    globalModifierCommandClauses: [{
      command: globalModifierCommand1,
      potentialArgs: ["g", "bar"],
    }, {
      command: globalModifierCommand2,
      potentialArgs: ["g", "bar"],
    }],
    unusedArgSequences: [],
  };

  scanResult = scanForGlobalModifierCommandClauses(
    [[
      "-1=g",
      "bar",
    ], [
      "-2=g",
      "bar",
    ]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);
});

Deno.test("Unused leading args whilst scanning for global modifier command", () => {
  const globalModifierCommand = getGlobalModifierCommand(
    "modifier",
    "m",
    true,
    true,
  );
  const globalModifierCommandsByName: ReadonlyMap<
    string,
    GlobalModifierCommand
  > = new Map([[globalModifierCommand.name, globalModifierCommand]]);
  const globalModifierCommandsByShortAlias: ReadonlyMap<
    string,
    GlobalModifierCommand
  > = new Map([[globalModifierCommand.shortAlias!, globalModifierCommand]]);

  let scanResult = scanForGlobalModifierCommandClauses(
    [[
      "hello",
      "--world",
      "subCommand",
      "bar",
      "--goo",
      "g",
      "--modifier",
      "g",
      "bar",
    ]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, {
    globalModifierCommandClauses: [{
      command: globalModifierCommand,
      potentialArgs: ["g", "bar"],
    }],
    unusedArgSequences: [[
      "hello",
      "--world",
      "subCommand",
      "bar",
      "--goo",
      "g",
    ]],
  });

  scanResult = scanForGlobalModifierCommandClauses(
    [[
      "hello",
      "--world",
      "--modifier",
      "g",
      "bar",
      "--globalCommand",
      "bar",
      "--goo",
      "g",
    ]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, {
    globalModifierCommandClauses: [{
      command: globalModifierCommand,
      potentialArgs: ["g", "bar", "--globalCommand", "bar", "--goo", "g"],
    }],
    unusedArgSequences: [["hello", "--world"]],
  });
  scanResult = scanForGlobalModifierCommandClauses(
    [[
      "hello",
      "--world",
    ], [
      "--modifier",
      "g",
      "bar",
      "--globalCommand",
      "bar",
      "--goo",
      "g",
    ]],
    globalModifierCommandsByName,
    globalModifierCommandsByShortAlias,
  );
  expectScanResult(scanResult, {
    globalModifierCommandClauses: [{
      command: globalModifierCommand,
      potentialArgs: ["g", "bar", "--globalCommand", "bar", "--goo", "g"],
    }],
    unusedArgSequences: [["hello", "--world"]],
  });
});

Deno.test("Sub-command scanned", () => {
  const subCommand = getSubCommandWithOptionAndPositional();
  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([[
    subCommand.name,
    subCommand,
  ]]);
  let scanResult = scanForNonModifierCommandClause([[
    "subCommand",
    "bar",
    "--goo",
    "g",
  ]], nonModifierCommandsByName);
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
      command: subCommand,
      potentialArgs: ["bar", "--goo", "g"],
    },
    unusedArgSequences: [],
  });

  scanResult = scanForNonModifierCommandClause([[], [
    "subCommand",
    "bar",
    "--goo",
    "g",
  ]], nonModifierCommandsByName);

  expectScanResult(scanResult, {
    nonModifierCommandClause: {
      command: subCommand,
      potentialArgs: ["bar", "--goo", "g"],
    },
    unusedArgSequences: [],
  });

  scanResult = scanForNonModifierCommandClause([[
    "subCommand",
    "bar",
    "--goo",
    "g",
  ]], nonModifierCommandsByName);

  expectScanResult(scanResult, {
    nonModifierCommandClause: {
      command: subCommand,
      potentialArgs: ["bar", "--goo", "g"],
    },
    unusedArgSequences: [],
  });
});

Deno.test("Global command scanned", () => {
  const globalCommand = getGlobalCommandWithShortAlias("globalCommand", "g");
  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([[
    globalCommand.name,
    globalCommand,
  ]]);
  const globalCommandsByShortAlias: ReadonlyMap<string, GlobalCommand> =
    new Map([[globalCommand.shortAlias!, globalCommand]]);

  let expected: ScanResult = {
    nonModifierCommandClause: {
      command: globalCommand,
      potentialArgs: ["g", "bar"],
    },
    unusedArgSequences: [],
  };

  let scanResult = scanForNonModifierCommandClause(
    [
      ["--globalCommand", "g", "bar"],
    ],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForNonModifierCommandClause(
    [["--globalCommand=g", "bar"]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForNonModifierCommandClause(
    [["-g", "g", "bar"]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForNonModifierCommandClause(
    [["-g=g", "bar"]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  expected = {
    nonModifierCommandClause: {
      command: globalCommand,
      potentialArgs: ["g", "bar"],
    },
    unusedArgSequences: [],
  };

  scanResult = scanForNonModifierCommandClause(
    [["-g=g", "bar"]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForNonModifierCommandClause(
    [["-g=g", "bar"]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);
});

Deno.test("Group command scanned", () => {
  const subCommand = getSubCommandWithOptionAndPositional();
  const groupCommand = getGroupCommand("group", [subCommand]);
  const groupAndMemberCommandsByJoinedName: ReadonlyMap<
    string,
    { groupCommand: GroupCommand; command: SubCommand }
  > = new Map([[`${groupCommand.name}:${subCommand.name}`, {
    groupCommand,
    command: subCommand,
  }]]);
  let expected: ScanResult = {
    nonModifierCommandClause: {
      groupCommand,
      command: subCommand,
      potentialArgs: ["bar", "--goo", "g"],
    },
    unusedArgSequences: [],
  };
  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([
    [groupCommand.name, groupCommand],
  ]);

  let scanResult = scanForNonModifierCommandClause(
    [[
      "group",
      "subCommand",
      "bar",
      "--goo",
      "g",
    ]],
    nonModifierCommandsByName,
    new Map(),
    groupAndMemberCommandsByJoinedName,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForNonModifierCommandClause(
    [[
      "group:subCommand",
      "bar",
      "--goo",
      "g",
    ]],
    new Map(),
    new Map(),
    groupAndMemberCommandsByJoinedName,
  );
  expectScanResult(scanResult, expected);

  expected = {
    nonModifierCommandClause: {
      groupCommand,
      command: subCommand,
      potentialArgs: ["bar", "--goo", "g"],
    },
    unusedArgSequences: [],
  };

  scanResult = scanForNonModifierCommandClause(
    [[
      "group:subCommand",
      "bar",
      "--goo",
      "g",
    ]],
    new Map(),
    new Map(),
    groupAndMemberCommandsByJoinedName,
  );
  expectScanResult(scanResult, expected);
});

Deno.test("Unused leading args whilst scanning for non-modifier command", () => {
  const globalCommand = getGlobalCommandWithShortAlias("globalCommand", "g");
  const subCommand = getSubCommandWithOptionAndPositional();

  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([
    [globalCommand.name, globalCommand as Command],
    [subCommand.name, subCommand as Command],
  ]);
  const globalCommandsByShortAlias: ReadonlyMap<string, GlobalCommand> =
    new Map([[globalCommand.shortAlias!, globalCommand]]);

  let scanResult = scanForNonModifierCommandClause(
    [[
      "hello",
      "--world",
      "subCommand",
      "bar",
      "--goo",
      "g",
      "--modifier",
      "g",
      "bar",
    ]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
      command: subCommand,
      potentialArgs: ["bar", "--goo", "g", "--modifier", "g", "bar"],
    },
    unusedArgSequences: [["hello", "--world"]],
  });

  scanResult = scanForNonModifierCommandClause(
    [[
      "hello",
      "--world",
      "--globalCommand",
      "bar",
      "--goo",
      "g",
      "--modifier",
      "g",
      "bar",
    ]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
      command: globalCommand,
      potentialArgs: ["bar", "--goo", "g", "--modifier", "g", "bar"],
    },
    unusedArgSequences: [["hello", "--world"]],
  });
  scanResult = scanForNonModifierCommandClause(
    [[
      "hello",
      "--world",
      "--globalCommand",
      "bar",
      "--goo",
      "g",
    ], ["--modifier", "g", "bar"]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
      command: globalCommand,
      potentialArgs: ["bar", "--goo", "g"],
    },
    unusedArgSequences: [["hello", "--world"], ["--modifier", "g", "bar"]],
  });
});

Deno.test("Sub-command with complex options scanned", () => {
  const subCommand = getSubCommandWithComplexOptions();

  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([
    [subCommand.name, subCommand],
  ]);

  let scanResult = scanForNonModifierCommandClause([[
    "subCommand",
    "-a.b.g=foo1",
    "-a.b.d=1",
    "-a.b.g=foo2",
    "-a.b.d=2",
    "-a.b.d=3",
    "-e.g=bar",
    "-e.d=1",
  ]], nonModifierCommandsByName);
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
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
    unusedArgSequences: [],
  });
  scanResult = scanForNonModifierCommandClause([[
    "subCommand",
    "--alpha.beta.gamma=foo1",
    "-a.b.d=1",
    "-a.b.g=foo2",
    "-a.b.d=2",
    "-a.b.d=3",
    "-e.g=bar",
    "-e.d=1",
  ]], nonModifierCommandsByName);
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
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
    unusedArgSequences: [],
  });
  scanResult = scanForNonModifierCommandClause([[
    "subCommand",
    "-e.g=bar",
    "-e.d=1",
    "-a.b[1].g=foo2",
    "--alpha.beta[0].gamma=foo1",
    "-a.b[1].d[1]=2",
    "-a.b[0].d=1",
    "-a.b[1].d[0]=3",
  ]], nonModifierCommandsByName);
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
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
    unusedArgSequences: [],
  });
});

Deno.test("Sub-command member not scanned if parent not specified", () => {
  const subCommand = getSubCommandWithOptionAndPositional();
  const groupCommand = getGroupCommand("group", [subCommand]);
  const groupAndMemberCommandsByJoinedName: ReadonlyMap<
    string,
    { groupCommand: GroupCommand; command: SubCommand }
  > = new Map([[`${groupCommand.name}:${subCommand.name}`, {
    groupCommand,
    command: subCommand,
  }]]);
  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([
    [groupCommand.name, groupCommand],
  ]);

  const scanResult = scanForNonModifierCommandClause(
    [[
      "subCommand",
      "foo",
      "--goo",
      "g",
    ]],
    nonModifierCommandsByName,
    new Map(),
    groupAndMemberCommandsByJoinedName,
  );
  expectScanResult(scanResult, {
    unusedArgSequences: [["subCommand", "foo", "--goo", "g"]],
  });
});

Deno.test("Global command normalising (tricky scenario 1)", () => {
  const globalCommand = getGlobalCommandWithShortAlias("globalCommand", "g");

  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([
    [globalCommand.name, globalCommand],
  ]);
  const globalCommandsByShortAlias: ReadonlyMap<string, GlobalCommand> =
    new Map([[globalCommand.shortAlias!, globalCommand]]);

  const expected: ScanResult = {
    nonModifierCommandClause: {
      command: globalCommand,
      potentialArgs: ["g=2", "bar=2"],
    },
    unusedArgSequences: [],
  };

  let scanResult = scanForNonModifierCommandClause(
    [[
      "--globalCommand",
      "g=2",
      "bar=2",
    ]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForNonModifierCommandClause(
    [[
      "--globalCommand=g=2",
      "bar=2",
    ]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForNonModifierCommandClause(
    [[
      "-g",
      "g=2",
      "bar=2",
    ]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);

  scanResult = scanForNonModifierCommandClause(
    [[
      "-g=g=2",
      "bar=2",
    ]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);
});

Deno.test("Global command normalising (tricky scenario 2)", () => {
  const globalCommand = getGlobalCommandWithShortAlias("globalCommand", "g");

  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([
    [globalCommand.name, globalCommand],
  ]);
  const globalCommandsByShortAlias: ReadonlyMap<string, GlobalCommand> =
    new Map([[globalCommand.shortAlias!, globalCommand]]);

  const expected: ScanResult = {
    nonModifierCommandClause: {
      command: globalCommand,
      potentialArgs: ["g="],
    },
    unusedArgSequences: [],
  };

  const scanResult = scanForNonModifierCommandClause(
    [[
      "--globalCommand",
      "g=",
    ]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, expected);
});

Deno.test("Two sub-commands specified (illegal scenario)", () => {
  const subCommand = getSubCommandWithOptionAndPositional();
  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([
    [subCommand.name, subCommand],
  ]);

  const scanResult = scanForNonModifierCommandClause([[
    "subCommand",
    "bar",
    "--goo",
    "g",
    "subCommand",
    "bar",
  ]], nonModifierCommandsByName);
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
      command: subCommand,
      potentialArgs: ["bar", "--goo", "g", "subCommand", "bar"],
    },
    unusedArgSequences: [],
  });
});

Deno.test("Unknown group member command rejected", () => {
  const subCommand = getSubCommandWithOptionAndPositional();
  const groupCommand = getGroupCommand("group", [subCommand]);
  const groupAndMemberCommandsByJoinedName: ReadonlyMap<
    string,
    { groupCommand: GroupCommand; command: SubCommand }
  > = new Map([[`${groupCommand.name}:${subCommand.name}`, {
    groupCommand,
    command: subCommand,
  }]]);
  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([
    [groupCommand.name, groupCommand],
  ]);

  let scanResult = scanForNonModifierCommandClause(
    [[
      "group",
      "blah",
      "bar",
      "--goo",
      "g",
    ]],
    nonModifierCommandsByName,
    new Map(),
    groupAndMemberCommandsByJoinedName,
  );
  expectScanResult(scanResult, {
    unusedArgSequences: [["group", "blah", "bar", "--goo", "g"]],
  });

  scanResult = scanForNonModifierCommandClause(
    [[
      "group:blah",
      "bar",
      "--goo",
      "g",
    ]],
    nonModifierCommandsByName,
    new Map(),
    groupAndMemberCommandsByJoinedName,
  );
  expectScanResult(scanResult, {
    unusedArgSequences: [["group:blah", "bar", "--goo", "g"]],
  });
});

Deno.test("Two group commands scanned (illegal scenario)", () => {
  const subCommand = getSubCommandWithOptionAndPositional();
  const groupCommand1 = getGroupCommand("group1", [subCommand]);
  const groupCommand2 = getGroupCommand("group2", [subCommand]);
  const groupAndMemberCommandsByJoinedName: ReadonlyMap<
    string,
    { groupCommand: GroupCommand; command: SubCommand }
  > = new Map([
    [`${groupCommand1.name}:${subCommand.name}`, {
      groupCommand: groupCommand1,
      command: subCommand,
    }],
    [`${groupCommand2.name}:${subCommand.name}`, {
      groupCommand: groupCommand2,
      command: subCommand,
    }],
  ]);
  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([
    [groupCommand1.name, groupCommand1],
    [groupCommand2.name, groupCommand2],
  ]);

  let scanResult = scanForNonModifierCommandClause(
    [[
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
    ]],
    nonModifierCommandsByName,
    new Map(),
    groupAndMemberCommandsByJoinedName,
  );
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
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
    unusedArgSequences: [],
  });

  scanResult = scanForNonModifierCommandClause(
    [[
      "group1",
      "subCommand",
      "bar",
      "--goo",
      "g",
      "group2:command",
      "bar",
      "--goo",
      "g",
    ]],
    new Map(),
    new Map(),
    groupAndMemberCommandsByJoinedName,
  );
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
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
    unusedArgSequences: [],
  });
});

Deno.test("Global command and sub-command scanned (illegal scenario)", () => {
  const globalCommand = getGlobalCommandWithShortAlias("globalCommand", "g");
  const subCommand = getSubCommandWithOptionAndPositional();
  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([
    [subCommand.name, subCommand as Command],
    [globalCommand.name, globalCommand as Command],
  ]);
  const globalCommandsByShortAlias: ReadonlyMap<string, GlobalCommand> =
    new Map([[globalCommand.shortAlias!, globalCommand]]);

  let scanResult = scanForNonModifierCommandClause(
    [[
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
    ]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
      command: subCommand,
      potentialArgs: [
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
      ],
    },
    unusedArgSequences: [],
  });

  scanResult = scanForNonModifierCommandClause(
    [[
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
    ]],
    nonModifierCommandsByName,
    globalCommandsByShortAlias,
  );
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
      command: subCommand,
      potentialArgs: [
        "bar",
        "--goo=g",
        "-1=g",
        "bar",
        "-g=bar",
        "--goo",
        "g",
        "-2=g",
        "bar",
      ],
    },
    unusedArgSequences: [],
  });
});

Deno.test("Group command and sub-command scanned (illegal scenario)", () => {
  const subCommand = getSubCommandWithOptionAndPositional();
  const groupCommand = getGroupCommand("group", [subCommand]);
  const nonModifierCommandsByName: ReadonlyMap<string, Command> = new Map([
    [subCommand.name, subCommand as Command],
    [groupCommand.name, groupCommand as Command],
  ]);
  const groupAndMemberCommandsByJoinedName: ReadonlyMap<
    string,
    { groupCommand: GroupCommand; command: SubCommand }
  > = new Map([
    [`${groupCommand.name}:${subCommand.name}`, {
      groupCommand,
      command: subCommand,
    }],
  ]);

  const scanResult = scanForNonModifierCommandClause(
    [[
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
    ]],
    nonModifierCommandsByName,
    new Map(),
    groupAndMemberCommandsByJoinedName,
  );
  expectScanResult(scanResult, {
    nonModifierCommandClause: {
      command: subCommand,
      potentialArgs: [
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
      ],
    },
    unusedArgSequences: [],
  });
});
