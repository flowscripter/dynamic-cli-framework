import process from "node:process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import ConfigurationServiceProvider from "../../../src/service/configuration/ConfigurationServiceProvider.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import jsonFormat from "../../../src/service/configuration/format/JsonConfigFormat.ts";
import yamlFormat from "../../../src/service/configuration/format/YamlConfigFormat.ts";
import tomlFormat from "../../../src/service/configuration/format/TomlConfigFormat.ts";
import type ConfigFormat from "../../../src/service/configuration/format/ConfigFormat.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

const originalHome = process.env["HOME"];

afterEach(() => {
  process.env["HOME"] = originalHome;
});

const yamlText = `# my config
defaults:
  command1:
    arg1: 1 # first
key-values:
  commands:
    command1:
      foo: bar
`;

const tomlText = `# my config
[defaults.command1]
arg1 = 1 # first

[key-values.commands.command1]
foo = "bar"
`;

const cases: Array<[string, ConfigFormat, string]> = [
  ["json", jsonFormat, JSON.stringify({ defaults: { command1: { arg1: 1 } } })],
  ["yaml", yamlFormat, yamlText],
  ["toml", tomlFormat, tomlText],
];

describe("ConfigurationServiceProvider with configFormat", () => {
  test.each(cases)("%s: default location uses the format extension", async (ext, format, text) => {
    const home = await fs.mkdtemp(path.join(tmpdir(), "home-"));
    process.env["HOME"] = home;
    const location = path.join(home, `.foo.${ext}`);
    await fs.writeFile(location, text);

    const provider = new ConfigurationServiceProvider(100, false, true, false, format);
    await provider.initService(new DefaultContext(getCLIConfig()));

    expect(provider.configLocation).toEqual(location);
    expect(provider.defaultsData.get("command1")).toEqual({ arg1: 1 });
  });

  test("default format is JSON", async () => {
    const home = await fs.mkdtemp(path.join(tmpdir(), "home-"));
    process.env["HOME"] = home;
    const provider = new ConfigurationServiceProvider(100, false, true);
    await provider.initService(new DefaultContext(getCLIConfig()));
    expect(provider.configLocation).toEqual(path.join(home, ".foo.json"));
  });

  test.each([
    ["yaml", yamlFormat, yamlText],
    ["toml", tomlFormat, tomlText],
  ] as Array<[string, ConfigFormat, string]>)(
    "%s: write back preserves comments and applies changes",
    async (ext, format, text) => {
      const folder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
      const location = path.join(folder, `config.${ext}`);
      await fs.writeFile(location, text);

      const provider = new ConfigurationServiceProvider(100, false, true, false, format);
      provider.setConfigLocation(location);
      await provider.initService(new DefaultContext(getCLIConfig()));

      provider.getKeyValueData("command", "command1").set("foo", "baz");
      provider.getKeyValueData("command", "command2").set("k", 1);
      provider.defaultsData.set("command1", { arg1: 2 });
      provider.defaultsData.set("command3", { arg9: "z" });
      await provider.flushIfDirty(true);

      const written = await fs.readFile(location, "utf-8");
      expect(written).toContain("# my config");
      expect(written).toContain("# first");
      expect(format.parse(written).data).toEqual({
        defaults: { command1: { arg1: 2 }, command3: { arg9: "z" } },
        "key-values": { commands: { command1: { foo: "baz" }, command2: { k: 1 } } },
      });

      // a second write keeps working off the text just written
      provider.defaultsData.set("command1", { arg1: 3 });
      await provider.flushIfDirty(true);
      const rewritten = await fs.readFile(location, "utf-8");
      expect(rewritten).toContain("# first");
      expect(format.parse(rewritten).data.defaults.command1).toEqual({ arg1: 3 });
    },
  );

  test("write creates a new file with the format when none was read", async () => {
    const folder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
    const location = path.join(folder, "new.toml");
    const provider = new ConfigurationServiceProvider(100, false, true, false, tomlFormat);
    provider.setConfigLocation(location);
    provider.defaultsData.set("command1", { arg1: 2 });
    await provider.flushIfDirty(true);
    expect(tomlFormat.parse(await fs.readFile(location, "utf-8")).data).toEqual({
      defaults: { command1: { arg1: 2 } },
    });
  });

  test("getConfigString serializes using the format", async () => {
    const provider = new ConfigurationServiceProvider(100, false, true, false, tomlFormat);
    provider.defaultsData.set("command1", { arg1: 2 });
    expect(tomlFormat.parse(provider.getConfigString()).data).toEqual({
      defaults: { command1: { arg1: 2 } },
    });
  });

  test("unparseable file is a hard failure and is not overwritten", async () => {
    const folder = await fs.mkdtemp(path.join(tmpdir(), "config-"));
    const location = path.join(folder, "config.toml");
    await fs.writeFile(location, "a = ");
    const provider = new ConfigurationServiceProvider(100, false, true, false, tomlFormat);
    provider.setConfigLocation(location);
    await expect(provider.initService(new DefaultContext(getCLIConfig()))).rejects.toThrow(
      "Failed to read config",
    );
    expect(await fs.readFile(location, "utf-8")).toEqual("a = ");
  });
});
