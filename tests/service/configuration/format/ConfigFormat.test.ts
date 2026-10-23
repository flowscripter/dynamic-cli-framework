import { describe, expect, test } from "bun:test";
import jsonFormat from "../../../../src/service/configuration/format/JsonConfigFormat.ts";
import yamlFormat from "../../../../src/service/configuration/format/YamlConfigFormat.ts";
import tomlFormat from "../../../../src/service/configuration/format/TomlConfigFormat.ts";
import type { ConfigData } from "../../../../src/service/configuration/format/ConfigFormat.ts";

function update(data: ConfigData, fn: (data: ConfigData) => void): ConfigData {
  const copy = structuredClone(data);
  fn(copy);
  return copy;
}

describe("jsonFormat", () => {
  test("parses, applies and serializes", () => {
    const { data, handle } = jsonFormat.parse('{"defaults":{"a":{"x":1}}}');
    expect(data).toEqual({ defaults: { a: { x: 1 } } });
    const changed = update(data, (d) => (d.defaults.a.x = 2));
    expect(jsonFormat.apply(handle, changed)).toEqual(JSON.stringify(changed, null, 2));
    expect(jsonFormat.serialize(changed)).toEqual(JSON.stringify(changed, null, 2));
    expect(jsonFormat.fileExtension).toEqual("json");
  });

  test("invalid text throws", () => {
    expect(() => jsonFormat.parse("{nope")).toThrow();
  });
});

describe("yamlFormat", () => {
  const source = `# file header
defaults:
  # about a
  a:
    x: 1 # x comment
    list:
      - 1
      - 2 # second
  b:
    y: s

key-values:
  commands:
    a:
      k: v
`;

  test("parse returns data and fileExtension is yaml", () => {
    const { data } = yamlFormat.parse(source);
    expect(data).toEqual({
      defaults: { a: { x: 1, list: [1, 2] }, b: { y: "s" } },
      "key-values": { commands: { a: { k: "v" } } },
    });
    expect(yamlFormat.fileExtension).toEqual("yaml");
  });

  test("apply with no changes returns identical text", () => {
    const { data, handle } = yamlFormat.parse(source);
    expect(yamlFormat.apply(handle, data)).toEqual(source);
  });

  test("apply preserves comments when changing, adding and removing values", () => {
    const { data, handle } = yamlFormat.parse(source);
    const changed = update(data, (d) => {
      d.defaults.a.x = 5;
      d.defaults.a.list[1] = 3;
      d.defaults.a.added = true;
      delete d.defaults.b;
      d.defaults.c = { z: { n: 1 } };
    });
    const text = yamlFormat.apply(handle, changed);
    expect(text).toContain("# file header");
    expect(text).toContain("# about a");
    expect(text).toContain("x: 5 # x comment");
    expect(text).toContain("- 3 # second");
    expect(text).not.toContain("y: s");
    expect(yamlFormat.parse(text).data).toEqual(changed);
  });

  test("apply replaces arrays whose length changed", () => {
    const { data, handle } = yamlFormat.parse(source);
    const changed = update(data, (d) => d.defaults.a.list.push(9));
    const text = yamlFormat.apply(handle, changed);
    expect(text).toContain("# file header");
    expect(yamlFormat.parse(text).data).toEqual(changed);
  });

  test("empty and comment only files", () => {
    for (const empty of ["", "# only a comment\n"]) {
      const { data, handle } = yamlFormat.parse(empty);
      expect(data).toEqual({});
      const text = yamlFormat.apply(handle, { defaults: { a: { x: 1 } } });
      expect(yamlFormat.parse(text).data).toEqual({ defaults: { a: { x: 1 } } });
      if (empty !== "") {
        expect(text).toContain("# only a comment");
      }
    }
  });

  test("invalid YAML and non-mapping documents throw", () => {
    expect(() => yamlFormat.parse("a: [unclosed")).toThrow();
    expect(() => yamlFormat.parse("- a\n- b\n")).toThrow("mapping");
  });

  test("serialize round trips", () => {
    const data = { defaults: { a: { x: 1 } } };
    expect(yamlFormat.parse(yamlFormat.serialize(data)).data).toEqual(data);
  });
});

describe("tomlFormat", () => {
  const source = `# file header
[defaults.a] # a comment
x = 1 # x comment

# about b
[defaults.b]
y = "s"

[key-values.commands.a]
k = "v"
`;

  test("parse returns data and fileExtension is toml", () => {
    const { data } = tomlFormat.parse(source);
    expect(data).toEqual({
      defaults: { a: { x: 1 }, b: { y: "s" } },
      "key-values": { commands: { a: { k: "v" } } },
    });
    expect(tomlFormat.fileExtension).toEqual("toml");
  });

  test("apply with no changes returns identical text", () => {
    const { data, handle } = tomlFormat.parse(source);
    expect(tomlFormat.apply(handle, data)).toEqual(source);
  });

  test("apply preserves comments when changing a value and removing a table", () => {
    const { data, handle } = tomlFormat.parse(source);
    const changed = update(data, (d) => {
      d.defaults.a.x = 2;
      delete d.defaults.b;
    });
    const text = tomlFormat.apply(handle, changed);
    expect(text).toContain("# file header");
    expect(text).toContain("[defaults.a] # a comment");
    expect(text).toContain("x = 2 # x comment");
    expect(tomlFormat.parse(text).data).toEqual(changed);
  });

  describe("new table placement", () => {
    test("new command table is appended after existing tables as a [table]", () => {
      const { data, handle } = tomlFormat.parse(source);
      const changed = update(data, (d) => (d.defaults.c = { z: 3 }));
      const text = tomlFormat.apply(handle, changed);
      expect(text.startsWith(source.trimEnd())).toBe(true);
      expect(text.trimEnd().endsWith("[defaults.c]\nz = 3")).toBe(true);
      expect(text).not.toContain("defaults.c =");
      expect(tomlFormat.parse(text).data).toEqual(changed);
    });

    test("new table with a nested complex value", () => {
      const { data, handle } = tomlFormat.parse(source);
      const changed = update(
        data,
        (d) => (d.defaults.c = { n: { q: 1 }, arr: [{ m: 1 }, { m: 2 }] }),
      );
      const text = tomlFormat.apply(handle, changed);
      expect(text.indexOf("[defaults.c]")).toBeGreaterThan(text.indexOf("[key-values.commands.a]"));
      expect(tomlFormat.parse(text).data).toEqual(changed);
    });

    test("new group:member table name is quoted", () => {
      const { data, handle } = tomlFormat.parse(source);
      const changed = update(data, (d) => (d.defaults["grp:member"] = { z: 3 }));
      const text = tomlFormat.apply(handle, changed);
      expect(text).toContain('[defaults."grp:member"]');
      expect(tomlFormat.parse(text).data).toEqual(changed);
    });

    test("new key-values scope table", () => {
      const { data, handle } = tomlFormat.parse(source);
      const changed = update(data, (d) => (d["key-values"].services = { svc: { k: 1 } }));
      const text = tomlFormat.apply(handle, changed);
      expect(text).toContain("[key-values.services]");
      expect(tomlFormat.parse(text).data).toEqual(changed);
    });

    test("new top level tables in a comment only file", () => {
      const { handle } = tomlFormat.parse("# only a comment\n");
      const changed = { defaults: { c: { z: 3 } } };
      const text = tomlFormat.apply(handle, changed);
      expect(text).toContain("# only a comment");
      expect(tomlFormat.parse(text).data).toEqual(changed);
    });

    test("new table in an empty file", () => {
      const { handle } = tomlFormat.parse("");
      const changed = { defaults: { c: { z: 3 } } };
      expect(tomlFormat.parse(tomlFormat.apply(handle, changed)).data).toEqual(changed);
    });

    test("parent defined as an inline table is still patched to valid TOML", () => {
      const inline = "defaults = { a = { x = 1 } } # inline\n";
      const { data, handle } = tomlFormat.parse(inline);
      const changed = update(data, (d) => (d.defaults.b = { y: 2 }));
      const text = tomlFormat.apply(handle, changed);
      expect(text).toContain("# inline");
      expect(tomlFormat.parse(text).data).toEqual(changed);
    });

    test("existing table gaining a key keeps its comments", () => {
      const compact = "# header\n[defaults.a]\nx = 1 # keep\n\n[defaults.b]\ny = 2\n";
      const { data, handle } = tomlFormat.parse(compact);
      const changed = update(data, (d) => (d.defaults.b.w = true));
      const text = tomlFormat.apply(handle, changed);
      expect(text).toContain("# header");
      expect(text).toContain("x = 1 # keep");
      expect(tomlFormat.parse(text).data).toEqual(changed);
    });
  });

  test("invalid TOML throws", () => {
    expect(() => tomlFormat.parse("a = ")).toThrow();
  });

  test("serialize round trips", () => {
    const data = { defaults: { a: { x: 1 } } };
    expect(tomlFormat.parse(tomlFormat.serialize(data)).data).toEqual(data);
  });
});
