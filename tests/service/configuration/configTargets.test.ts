import process from "node:process";
import { describe, expect, test } from "bun:test";
import {
  ComplexValueTypeName,
  ValueTypeName,
  type Command,
  type ComplexOption,
  type GlobalCommand,
  type GroupCommand,
  type Option,
  type SubCommand,
} from "@flowscripter/dynamic-cli-framework-api";
import DefaultCommandRegistry from "../../../src/runtime/registry/DefaultCommandRegistry.ts";
import {
  MASK,
  applyChanges,
  collectSentinels,
  containsSecret,
  getAtPath,
  getConfigTargets,
  isOverriddenByEnvVar,
  maskDefault,
  parseOptionPath,
  prepareChange,
  prepareGlobalValue,
  removeAtPath,
  resolveOptionPath,
  setAtPath,
  type ConfigTarget,
} from "../../../src/service/configuration/configTargets.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

const tokenOption: Option = { name: "token", type: ValueTypeName.SECRET, isOptional: true };
const portOption: Option = { name: "port", type: ValueTypeName.INTEGER, isOptional: true };
const proxy: ComplexOption = {
  name: "proxy",
  type: ComplexValueTypeName.COMPLEX,
  isOptional: true,
  properties: [{ name: "host", type: ValueTypeName.STRING }, tokenOption],
};
const servers: ComplexOption = {
  name: "servers",
  type: ComplexValueTypeName.COMPLEX,
  isArray: true,
  isOptional: true,
  properties: [{ name: "host", type: ValueTypeName.STRING }, portOption],
};
const tags: Option = {
  name: "tags",
  type: ValueTypeName.STRING,
  isArray: true,
  isOptional: true,
};
const keys: Option = {
  name: "keys",
  type: ValueTypeName.SECRET,
  isArray: true,
  isOptional: true,
};

const connect: SubCommand = {
  name: "connect",
  enableConfiguration: true,
  options: [
    { name: "host", type: ValueTypeName.STRING },
    portOption,
    tokenOption,
    keys,
    tags,
    proxy,
    servers,
  ],
  positionals: [],
  execute: () => Promise.resolve(),
};

const target: ConfigTarget = { key: "connect", command: connect, options: connect.options };

describe("getConfigTargets", () => {
  test("collects global, global modifier, sub and group member commands", () => {
    const global: GlobalCommand = {
      name: "theme",
      enableConfiguration: true,
      argument: { type: ValueTypeName.STRING },
      execute: () => Promise.resolve(),
    };
    const noArgument: GlobalCommand = {
      name: "noarg",
      enableConfiguration: true,
      execute: () => Promise.resolve(),
    };
    const modifier = {
      name: "level",
      enableConfiguration: true,
      argument: { type: ValueTypeName.STRING },
      executePriority: 1,
      modifyConfiguration: () => Promise.resolve(),
    };
    const configModifier = { ...modifier, name: "config" };
    const member: SubCommand = {
      name: "add",
      enableConfiguration: true,
      options: [{ name: "x", type: ValueTypeName.STRING }],
      positionals: [],
      execute: () => Promise.resolve(),
    };
    const plainMember: SubCommand = { ...member, name: "plain", enableConfiguration: false };
    const group: GroupCommand = {
      name: "grp",
      memberSubCommands: [member, plainMember],
      execute: () => Promise.resolve(),
    };
    const registry = new DefaultCommandRegistry([
      global,
      noArgument,
      modifier,
      configModifier,
      connect,
      { ...connect, name: "off", enableConfiguration: false },
      group,
    ] as Array<Command>);
    const targets = getConfigTargets(registry);
    expect([...targets.keys()].sort()).toEqual(["connect", "grp:add", "level", "theme"]);
    expect(targets.get("grp:add")!.group).toBe(group);
    expect(targets.get("theme")!.argument).toBeDefined();
  });
});

describe("parseOptionPath and resolveOptionPath", () => {
  test("parse errors", () => {
    expect(parseOptionPath("a.b.c.d.e.f.g.h.i.j.k.l")).toContain("maximum nesting depth");
    expect(parseOptionPath("a[x]")).toContain("invalid option path");
    expect(parseOptionPath("a..b")).toContain("invalid option path");
    expect(parseOptionPath("a[1].b")).toEqual([{ name: "a", index: 1 }, { name: "b" }]);
  });

  test("resolve errors and success", () => {
    expect(resolveOptionPath(target, "a[x]")).toContain("invalid option path");
    expect(resolveOptionPath(target, "nope")).toContain("unknown option 'nope'");
    expect(resolveOptionPath(target, "host[0]")).toContain("is not an array");
    expect(resolveOptionPath(target, "host.x")).toContain("has no properties");
    expect(resolveOptionPath(target, "servers.host")).toContain("requires an index");
    expect(resolveOptionPath(target, "proxy.nope")).toContain("unknown option 'nope'");
    const ok = resolveOptionPath(target, "servers[1].port");
    expect(typeof ok).toBe("object");
    expect((ok as { leaf: Option }).leaf.name).toBe("port");
  });
});

describe("containsSecret", () => {
  test("detects nested secrets", () => {
    expect(containsSecret(proxy)).toBe(true);
    expect(containsSecret(servers)).toBe(false);
    expect(containsSecret(keys)).toBe(true);
    expect(containsSecret(tags)).toBe(false);
  });
});

describe("getAtPath, setAtPath and removeAtPath", () => {
  test("getAtPath handles missing and non-object parents and arrays", () => {
    const root = { a: { b: [{ c: 1 }] }, s: "str", n: null };
    expect(getAtPath(root, [{ name: "a" }, { name: "b", index: 0 }, { name: "c" }])).toBe(1);
    expect(getAtPath(root, [{ name: "s" }, { name: "x" }])).toBeUndefined();
    expect(getAtPath(root, [{ name: "n" }, { name: "x" }])).toBeUndefined();
    expect(getAtPath(root, [{ name: "a", index: 0 }])).toBeUndefined();
    expect(getAtPath(root, [{ name: "q" }, { name: "x" }])).toBeUndefined();
  });

  test("setAtPath creates parents, replaces non-objects and rejects sparse arrays", () => {
    const root: Record<string, unknown> = { s: "str", arr: "notarray", el: [1] };
    setAtPath(root, [{ name: "s" }, { name: "x" }], 1);
    expect(root["s"]).toEqual({ x: 1 });
    setAtPath(root, [{ name: "arr", index: 0 }, { name: "x" }], 2);
    expect(root["arr"]).toEqual([{ x: 2 }]);
    setAtPath(root, [{ name: "arr", index: 1 }, { name: "x" }], 3);
    setAtPath(root, [{ name: "arr", index: 1 }, { name: "y" }], 4);
    expect(root["arr"]).toEqual([{ x: 2 }, { x: 3, y: 4 }]);
    setAtPath(root, [{ name: "el", index: 0 }, { name: "x" }], 5);
    expect(root["el"]).toEqual([{ x: 5 }]);
    setAtPath(root, [{ name: "el", index: 1 }], 6);
    expect(root["el"]).toEqual([{ x: 5 }, 6]);
    expect(() => setAtPath(root, [{ name: "el", index: 9 }], 1)).toThrow("sparse");
  });

  test("removeAtPath prunes empty parents, stops at arrays and rejects element removal", () => {
    const root: Record<string, unknown> = {
      a: { b: { c: 1 } },
      keep: { x: 1, y: { z: 2 } },
      list: [{ k: 1 }],
    };
    expect(removeAtPath(root, [{ name: "nope" }])).toBe(false);
    expect(removeAtPath(root, [{ name: "a" }, { name: "b" }, { name: "c" }])).toBe(true);
    expect(root["a"]).toBeUndefined();
    expect(removeAtPath(root, [{ name: "keep" }, { name: "y" }, { name: "z" }])).toBe(true);
    expect(root["keep"]).toEqual({ x: 1 });
    expect(removeAtPath(root, [{ name: "list", index: 0 }, { name: "k" }])).toBe(true);
    expect(root["list"]).toEqual([{}]);
    expect(() => removeAtPath(root, [{ name: "list", index: 0 }])).toThrow("not supported");
  });
});

describe("collectSentinels and maskDefault", () => {
  test("collects sentinels from nested values", () => {
    expect(collectSentinels("plain")).toEqual([]);
    expect(collectSentinels(5)).toEqual([]);
    expect(
      collectSentinels({
        a: "__SECRET__:one",
        b: ["__SECRET__:two", "x"],
        c: { d: "__SECRET__:3" },
      }),
    ).toEqual(["__SECRET__:one", "__SECRET__:two", "__SECRET__:3"]);
  });

  test("masks global arguments, typed secrets in complex/array options and stray sentinels", () => {
    const secretGlobal: ConfigTarget = {
      key: "g",
      command: { name: "g" } as Command,
      argument: { type: ValueTypeName.SECRET },
      options: [],
    };
    expect(maskDefault(secretGlobal, "abc")).toBe(MASK);
    expect(maskDefault(secretGlobal, undefined)).toBeUndefined();
    const plainGlobal = { ...secretGlobal, argument: { type: ValueTypeName.STRING } };
    expect(maskDefault(plainGlobal, "abc")).toBe("abc");
    expect(maskDefault(plainGlobal, "__SECRET__:x")).toBe(MASK);

    const masked = maskDefault(target, {
      host: "h",
      token: "plain",
      keys: ["a", "b"],
      proxy: { host: "p", token: "t" },
      servers: [{ host: "s", port: 1 }],
      tags: ["__SECRET__:z"],
      extra: { deep: ["__SECRET__:q"] },
      nothing: null,
    }) as Record<string, unknown>;
    expect(masked).toEqual({
      host: "h",
      token: MASK,
      keys: [MASK, MASK],
      proxy: { host: "p", token: MASK },
      servers: [{ host: "s", port: 1 }],
      tags: [MASK],
      extra: { deep: [MASK] },
      nothing: null,
    });
    expect(maskDefault(target, "scalar")).toBe("scalar");
    expect(maskDefault(target, [1])).toEqual([1]);
    expect(maskDefault(undefined, { a: "__SECRET__:x" })).toEqual({ a: MASK });
    expect((maskDefault(target, { proxy: null }) as Record<string, unknown>)["proxy"]).toBeNull();
  });
});

describe("prepareChange", () => {
  test("whole-value errors", () => {
    expect(prepareChange(target, "nope", "1", [])).toContain("unknown option");
    expect(prepareChange(target, "tags", "a", [])).toContain("requires a JSON array");
    expect(prepareChange(target, "servers[0]", "a", [])).toContain("requires a JSON object");
    expect(prepareChange(target, "proxy", '{"host":"h"}', [])).toContain("SECRET");
    expect(prepareChange(target, "tags", "[1,", [])).toContain("invalid JSON");
    expect(prepareChange(target, "servers", '[{"host":"h","port":"x"}]', [])).toContain("servers");
  });

  test("successful conversions", () => {
    const whole = prepareChange(target, "servers", '[{"host":"h","port":1}]', []);
    expect(whole).toMatchObject({ value: [{ host: "h", port: 1 }], isSecret: false });
    const element = prepareChange(target, "tags[0]", "x", []);
    expect(element).toMatchObject({ value: "x", isSecret: false });
    const secret = prepareChange(target, "proxy.token", "s", []);
    expect(secret).toMatchObject({ value: "s", isSecret: true });
  });
});

describe("prepareGlobalValue", () => {
  const global: GlobalCommand = {
    name: "theme",
    enableConfiguration: true,
    argument: { type: ValueTypeName.STRING, allowableValues: ["dark"] },
    execute: () => Promise.resolve(),
  };
  const gTarget: ConfigTarget = {
    key: "theme",
    command: global,
    argument: global.argument,
    options: [],
  };

  test("valid, invalid and secret values", () => {
    expect(prepareGlobalValue(gTarget, "dark", [])).toEqual({ value: "dark", isSecret: false });
    expect(typeof prepareGlobalValue(gTarget, "pink", [])).toBe("string");
    const secretTarget = { ...gTarget, argument: { type: ValueTypeName.SECRET } };
    expect(prepareGlobalValue(secretTarget, "s", [])).toEqual({ value: "s", isSecret: true });
  });
});

describe("applyChanges", () => {
  test("applies changes without mutating existing, and reports sparse errors", () => {
    const existing = { host: "h", tags: ["a"] };
    const change = prepareChange(target, "tags[1]", "b", [])!;
    const result = applyChanges(target, existing as never, [change as never], []);
    expect(result).toEqual({ host: "h", tags: ["a", "b"] });
    expect(existing.tags).toEqual(["a"]);
    const bad = prepareChange(target, "tags[7]", "b", [])!;
    expect(applyChanges(target, existing as never, [bad as never], [])).toContain("sparse");
    expect(applyChanges(target, undefined, [change as never], [])).toBeDefined();
  });

  test("reports custom validation failures", () => {
    const validated: SubCommand = {
      ...connect,
      options: [
        {
          name: "port",
          type: ValueTypeName.INTEGER,
          isOptional: true,
          validate: (v) => ((v as number) % 2 === 0 ? undefined : "must be even"),
        },
      ],
    };
    const t: ConfigTarget = { key: "v", command: validated, options: validated.options };
    const deferred: Array<never> = [];
    const change = prepareChange(t, "port", "3", deferred);
    expect(typeof change).toBe("object");
    const res = applyChanges(t, undefined, [change as never], deferred);
    expect(res).toContain("must be even");
  });
});

describe("isOverriddenByEnvVar", () => {
  const cliConfig = getCLIConfig();

  test("false when env vars are disabled", () => {
    expect(isOverriddenByEnvVar({ envVarsEnabled: false }, cliConfig, target, [])).toBe(false);
  });

  test("sub command option and global command env vars", () => {
    process.env["FOO_CONNECT_HOST"] = "x";
    process.env["FOO_THEME"] = "dark";
    try {
      const provider = { envVarsEnabled: true };
      expect(isOverriddenByEnvVar(provider, cliConfig, target, [{ name: "host" }])).toBe(true);
      expect(isOverriddenByEnvVar(provider, cliConfig, target, [{ name: "port" }])).toBe(false);
      const global: GlobalCommand = {
        name: "theme",
        enableConfiguration: true,
        argument: { type: ValueTypeName.STRING },
        execute: () => Promise.resolve(),
      };
      const gTarget: ConfigTarget = {
        key: "theme",
        command: global,
        argument: global.argument,
        options: [],
      };
      expect(isOverriddenByEnvVar(provider, cliConfig, gTarget, [])).toBe(true);
    } finally {
      delete process.env["FOO_CONNECT_HOST"];
      delete process.env["FOO_THEME"];
    }
  });
});
