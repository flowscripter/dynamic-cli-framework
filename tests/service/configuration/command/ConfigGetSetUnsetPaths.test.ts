import process from "node:process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  ARGUMENT_PROMPTER_SERVICE_ID,
  PRINTER_SERVICE_ID,
  ValueTypeName,
  ComplexValueTypeName,
  type Command,
  type GlobalCommand,
  type SubCommand,
  type Values,
} from "@flowscripter/dynamic-cli-framework-api";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import DefaultCommandRegistry from "../../../../src/runtime/registry/DefaultCommandRegistry.ts";
import ConfigurationServiceProvider from "../../../../src/service/configuration/ConfigurationServiceProvider.ts";
import type DefaultConfigurationService from "../../../../src/service/configuration/DefaultConfigurationService.ts";
import tomlFormat from "../../../../src/service/configuration/format/TomlConfigFormat.ts";
import type { SecretsApi } from "../../../../src/service/configuration/DefaultSecretService.ts";
import DefaultConfigurationServiceClass from "../../../../src/service/configuration/DefaultConfigurationService.ts";
import jsonFormat from "../../../../src/service/configuration/format/JsonConfigFormat.ts";
import ConfigGetSubCommand from "../../../../src/service/configuration/command/ConfigGetSubCommand.ts";
import ConfigSetSubCommand from "../../../../src/service/configuration/command/ConfigSetSubCommand.ts";
import ConfigUnsetSubCommand from "../../../../src/service/configuration/command/ConfigUnsetSubCommand.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";

const originalHome = process.env["HOME"];
let home: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(tmpdir(), "home-"));
  process.env["HOME"] = home;
});
afterEach(() => {
  process.env["HOME"] = originalHome;
});

const themeCommand: GlobalCommand = {
  name: "theme",
  enableConfiguration: true,
  argument: { type: ValueTypeName.STRING, allowableValues: ["dark", "light"] },
  execute: () => Promise.resolve(),
};

const connectCommand: SubCommand = {
  name: "connect",
  enableConfiguration: true,
  options: [
    { name: "host", type: ValueTypeName.STRING },
    { name: "port", type: ValueTypeName.INTEGER, minValueInclusive: 1, maxValueInclusive: 65535 },
    { name: "token", type: ValueTypeName.SECRET, isOptional: true },
    { name: "tags", type: ValueTypeName.STRING, isArray: true, isOptional: true },
    {
      name: "proxy",
      type: ComplexValueTypeName.COMPLEX,
      isOptional: true,
      properties: [
        { name: "host", type: ValueTypeName.STRING },
        { name: "port", type: ValueTypeName.INTEGER },
      ],
    },
    { name: "secure", type: ValueTypeName.BOOLEAN, isOptional: true },
  ],
  positionals: [],
  execute: () => Promise.resolve(),
};

const hiddenCommand: SubCommand = {
  name: "hidden",
  options: [{ name: "x", type: ValueTypeName.STRING }],
  positionals: [],
  execute: () => Promise.resolve(),
};

const looseCommand: SubCommand = {
  name: "loose",
  enableConfiguration: true,
  options: [
    { name: "a", type: ValueTypeName.STRING, isOptional: true },
    { name: "b", type: ValueTypeName.INTEGER, defaultValue: 3 },
    { name: "keys", type: ValueTypeName.SECRET, isArray: true, isOptional: true },
  ],
  positionals: [],
  execute: () => Promise.resolve(),
};

const validatedCommand: SubCommand = {
  name: "validated",
  enableConfiguration: true,
  options: [
    {
      name: "a",
      type: ValueTypeName.STRING,
      isOptional: true,
      validate: (v) => (v === "bad" ? "no good" : undefined),
    },
  ],
  positionals: [],
  execute: () => Promise.resolve(),
};

const secretGlobal: GlobalCommand = {
  name: "apikey",
  enableConfiguration: true,
  argument: { type: ValueTypeName.SECRET },
  execute: () => Promise.resolve(),
};

class FakeSecrets implements SecretsApi {
  store = new Map<string, string>();
  get({ name }: { service: string; name: string }) {
    return Promise.resolve(this.store.get(name) ?? null);
  }
  set({ name, value }: { service: string; name: string; value: string }) {
    this.store.set(name, value);
    return Promise.resolve();
  }
  delete({ name }: { service: string; name: string }) {
    return Promise.resolve(this.store.delete(name));
  }
}

async function setup(
  options: {
    format?: typeof tomlFormat;
    secrets?: FakeSecrets;
    stdin?: boolean;
    envVars?: boolean;
  } = {},
) {
  const registry = new DefaultCommandRegistry([
    themeCommand,
    connectCommand,
    hiddenCommand,
    looseCommand,
    validatedCommand,
    secretGlobal,
  ] as Array<Command>);
  const secrets = options.secrets ?? new FakeSecrets();
  const provider = new ConfigurationServiceProvider(
    100,
    options.envVars ?? false,
    true,
    true,
    options.format,
    registry,
    secrets,
  );
  const cliConfig = getCLIConfig();
  const context = new DefaultContext(cliConfig, {
    stdin: options.stdin ?? false,
    stdout: false,
    stderr: false,
  });
  const out = { info: [] as Array<string>, warn: [] as Array<string>, print: [] as Array<string> };
  context.addServiceInstance(PRINTER_SERVICE_ID, {
    info: (m: string) => (out.info.push(m), Promise.resolve()),
    warn: (m: string) => (out.warn.push(m), Promise.resolve()),
    print: (m: string) => (out.print.push(m), Promise.resolve()),
  });
  await provider.getServiceInfo(cliConfig);
  const service: DefaultConfigurationService = provider.configurationService;
  await provider.initService(context);
  return {
    provider,
    service,
    context,
    out,
    secrets,
    get: new ConfigGetSubCommand(service),
    set: (stdin?: string) => new ConfigSetSubCommand(service, () => Promise.resolve(stdin ?? "")),
    unset: new ConfigUnsetSubCommand(service),
  };
}

const exec = (cmd: SubCommand, ctx: unknown, values: Values) =>
  cmd.execute(ctx as DefaultContext, values);

const prompter = (t: { context: DefaultContext }, answers: Array<Values | undefined>) => {
  const asked: Array<Array<string>> = [];
  t.context.addServiceInstance(ARGUMENT_PROMPTER_SERVICE_ID, {
    promptForArguments: (args: ReadonlyArray<{ name: string }>) => {
      asked.push(args.map((a) => a.name));
      return Promise.resolve(answers.shift());
    },
  });
  return asked;
};

describe("config set prompting and argument errors", () => {
  test("prompts for the command, then for a global value", async () => {
    const t = await setup();
    const asked = prompter(t, [{ command: "theme" }, { value: "light" }]);
    await exec(t.set(), t.context, {});
    expect(asked).toEqual([["command"], ["value"]]);
    expect(t.provider.defaultsData.get("theme")).toBe("light");
  });

  test("prompts for and stores a global SECRET value as a sentinel", async () => {
    const t = await setup();
    prompter(t, [{ value: "topsecret" }]);
    await exec(t.set(), t.context, { command: "apikey" });
    expect([...t.secrets.store.values()]).toEqual(["topsecret"]);
    expect((t.provider.defaultsData.get("apikey") as string).startsWith("__SECRET__:")).toBe(true);
    expect(await fs.readFile(path.join(home, ".foo.json"), "utf8")).not.toContain("topsecret");
  });

  test("sets a global SECRET value from stdin and from an argument", async () => {
    const t = await setup();
    await exec(t.set("fromstdin\n"), t.context, { command: "apikey", "value-stdin": true });
    expect([...t.secrets.store.values()]).toEqual(["fromstdin"]);
    await exec(t.set(), t.context, { command: "apikey", value: "again" });
    expect([...t.secrets.store.values()]).toEqual(["again"]);
  });

  test("global command failures", async () => {
    const t = await setup();
    await expect(
      exec(t.set(), t.context, { command: "theme", option: "x", value: "dark" }),
    ).rejects.toThrow("no options");
    await expect(exec(t.set(), t.context, { command: "theme" })).rejects.toThrow(
      "prompting is not available",
    );
    prompter(t, [undefined]);
    await expect(exec(t.set(), t.context, { command: "theme" })).rejects.toThrow(
      "--value is required",
    );
  });

  test("unknown command and missing option/value combinations", async () => {
    const t = await setup();
    await expect(exec(t.set(), t.context, { command: "nope", value: "1" })).rejects.toThrow(
      "Unknown or non-configurable",
    );
    await expect(exec(t.set(), t.context, { command: "connect", value: "1" })).rejects.toThrow(
      "--option is required with --value",
    );
    await expect(
      exec(t.set("v"), t.context, { command: "connect", "value-stdin": true }),
    ).rejects.toThrow("--option is required with --value-stdin");
  });

  test("unknown option path and invalid raw values", async () => {
    const t = await setup();
    await expect(
      exec(t.set(), t.context, { command: "connect", option: "proxy.zzz", value: "1" }),
    ).rejects.toThrow("valid options");
    await expect(
      exec(t.set(), t.context, { command: "connect", option: "tags", value: "a" }),
    ).rejects.toThrow("JSON array");
    expect(t.provider.defaultsData.size).toBe(0);
  });

  test("custom validators of the target are applied", async () => {
    const t = await setup();
    await expect(
      exec(t.set(), t.context, { command: "validated", option: "a", value: "bad" }),
    ).rejects.toThrow("no good");
    await exec(t.set(), t.context, { command: "validated", option: "a", value: "ok" });
    expect(t.provider.defaultsData.get("validated")).toEqual({ a: "ok" });
  });

  test("prompts for an option then its value when nothing is mandatory", async () => {
    const t = await setup();
    const asked = prompter(t, [{ option: "a" }, { a: "hello" }]);
    await exec(t.set(), t.context, { command: "loose" });
    expect(asked).toEqual([["option"], ["a"]]);
    expect(t.provider.defaultsData.get("loose")).toEqual({ a: "hello" });
  });

  test("fails listing options when nothing is mandatory and prompting is unavailable", async () => {
    const t = await setup();
    await expect(exec(t.set(), t.context, { command: "loose" })).rejects.toThrow(
      "valid options: a, b, keys",
    );
  });

  test("prompts for the value of an array element or whole option", async () => {
    const t = await setup();
    prompter(t, [{ tags: "first" }, { tags: ["x", "y"] }]);
    await exec(t.set(), t.context, { command: "connect", option: "tags[0]" });
    expect(t.provider.defaultsData.get("connect")).toEqual({ tags: ["first"] });
    await exec(t.set(), t.context, { command: "connect", option: "tags" });
    expect(t.provider.defaultsData.get("connect")).toEqual({ tags: ["x", "y"] });
  });

  test("a prompted SECRET array is rejected and a prompted single SECRET is stored", async () => {
    const t = await setup();
    prompter(t, [{ keys: ["a"] }]);
    await expect(exec(t.set(), t.context, { command: "loose", option: "keys" })).rejects.toThrow(
      "contains SECRET values",
    );
    const t2 = await setup();
    prompter(t2, [{ token: "pw" }]);
    await exec(t2.set(), t2.context, { command: "connect", option: "token" });
    expect([...t2.secrets.store.values()]).toEqual(["pw"]);
  });

  test("warns when an environment variable overrides the default", async () => {
    const t = await setup({ envVars: true });
    process.env["FOO_CONNECT_PORT"] = "9";
    process.env["FOO_THEME"] = "dark";
    try {
      await exec(t.set(), t.context, { command: "connect", option: "port", value: "8" });
      await exec(t.set(), t.context, { command: "theme", value: "light" });
    } finally {
      delete process.env["FOO_CONNECT_PORT"];
      delete process.env["FOO_THEME"];
    }
    expect(t.out.warn.join("")).toContain("overrides the default for connect.port");
    expect(t.out.warn.join("")).toContain("overrides the default for theme");
  });

  test("fails to write when there is no config location", async () => {
    const t = await setup();
    t.service.configLocation = undefined;
    await expect(exec(t.set(), t.context, { command: "theme", value: "dark" })).rejects.toThrow(
      "no config location",
    );
    expect(t.provider.defaultsData.size).toBe(0);
  });

  test("a failing secret store restores earlier secrets", async () => {
    const t = await setup();
    const ctx = t.context;
    await exec(t.set(), ctx, { command: "connect", option: "token", value: "one" });
    const original = t.secrets.set.bind(t.secrets);
    t.secrets.set = ({ name, value }) =>
      value === "two"
        ? Promise.reject(new Error("store down"))
        : original({ service: "", name, value });
    await expect(
      exec(t.set(), ctx, { command: "connect", option: "token", value: "two" }),
    ).rejects.toThrow("store down");
    expect([...t.secrets.store.values()]).toEqual(["one"]);
  });
});

describe("config set validators", () => {
  const ctx = (set: ConfigSetSubCommand, name: number, values: Values) => ({
    values,
    command: set,
    path: "",
    argument: set.options[name]!,
  });

  test("option and value validators for global and unknown commands", async () => {
    const t = await setup();
    const set = t.set();
    const option = set.options[1]!;
    const value = set.options[2]!;
    expect(option.validate!("x", ctx(set, 1, { command: "theme" }))).toContain("no options");
    expect(option.validate!("x", ctx(set, 1, {}))).toBeUndefined();
    expect(option.validate!("x", ctx(set, 1, { command: "zzz" }))).toBeUndefined();
    expect(value.validate!("x", ctx(set, 2, {}))).toBeUndefined();
    expect(value.validate!("dark", ctx(set, 2, { command: "theme" }))).toBeUndefined();
    expect(value.validate!("pink", ctx(set, 2, { command: "theme" }))).toBeDefined();
    expect(value.validate!("x", ctx(set, 2, { command: "theme", option: "o" }))).toContain(
      "no options",
    );
    expect(set.options[0]!.validate!("zzz", ctx(set, 0, {}))).toContain("valid commands");
    expect(set.options[3]!.validate!(false, ctx(set, 3, { value: "x" }))).toBeUndefined();
    expect(set.options[3]!.validate!(true, ctx(set, 3, {}))).toBeUndefined();
  });
});

describe("config unset", () => {
  const ctxFor = (u: ConfigUnsetSubCommand, i: number, values: Values) => ({
    values,
    command: u,
    path: "",
    argument: u.options[i]!,
  });

  test("prompts for the command when defaults exist and fails otherwise", async () => {
    const t = await setup();
    await expect(exec(t.unset, t.context, {})).rejects.toThrow("--command is required");
    await exec(t.set(), t.context, { command: "theme", value: "dark" });
    await expect(exec(t.unset, t.context, {})).rejects.toThrow("--command is required");
    prompter(t, [{ command: "theme" }]);
    await exec(t.unset, t.context, {});
    expect(t.provider.defaultsData.has("theme")).toBe(false);
    expect(t.out.info.join("")).toContain("Removed default theme");
  });

  test("option failures and no-ops", async () => {
    const t = await setup();
    await expect(exec(t.unset, t.context, { command: "nope", option: "x" })).rejects.toThrow(
      "Unknown or non-configurable",
    );
    await exec(t.unset, t.context, { command: "connect", option: "port" });
    expect(t.out.info.join("")).toContain("Nothing to unset for connect.port");
    await exec(t.set(), t.context, { command: "connect", option: "port", value: "1" });
    await expect(exec(t.unset, t.context, { command: "connect", option: "zzz" })).rejects.toThrow(
      "unknown option",
    );
    await exec(t.unset, t.context, { command: "connect", option: "host" });
    expect(t.out.info.join("")).toContain("Nothing to unset for connect.host");
    expect(t.provider.defaultsData.get("connect")).toEqual({ port: 1 });
  });

  test("unsets a whole stored entry for a command which is no longer configurable", async () => {
    const t = await setup();
    t.provider.defaultsData.set("gone", { a: 1 });
    await exec(t.unset, t.context, { command: "gone" });
    expect(t.provider.defaultsData.has("gone")).toBe(false);
  });

  test("a global SECRET unset deletes the stored secret", async () => {
    const t = await setup();
    await exec(t.set(), t.context, { command: "apikey", value: "k" });
    await exec(t.unset, t.context, { command: "apikey" });
    expect(t.secrets.store.size).toBe(0);
  });

  test("validators", async () => {
    const t = await setup();
    const u = t.unset;
    expect(u.options[0]!.validate!("connect", ctxFor(u, 0, {}))).toBeUndefined();
    expect(u.options[0]!.validate!("zzz", ctxFor(u, 0, {}))).toContain("valid commands");
    t.provider.defaultsData.set("gone", {});
    expect(u.options[0]!.validate!("gone", ctxFor(u, 0, {}))).toBeUndefined();
    const option = u.options[1]!;
    expect(option.validate!("x", ctxFor(u, 1, {}))).toBeUndefined();
    expect(option.validate!("x", ctxFor(u, 1, { command: "theme" }))).toContain("no options");
    expect(option.validate!("zzz", ctxFor(u, 1, { command: "connect" }))).toContain(
      "valid options",
    );
    expect(option.validate!("proxy.port", ctxFor(u, 1, { command: "connect" }))).toBeUndefined();
  });
});

describe("config get", () => {
  test("shows a single global command, env overrides and nested values", async () => {
    const t = await setup({ envVars: true });
    await exec(t.set(), t.context, { command: "theme", value: "dark" });
    await exec(t.set(), t.context, { command: "connect", option: "proxy.port", value: "3" });
    await exec(t.set(), t.context, { command: "connect", option: "tags", value: '["a"]' });
    process.env["FOO_THEME"] = "light";
    process.env["FOO_CONNECT_HOST"] = "h";
    try {
      await exec(t.get, t.context, {});
    } finally {
      delete process.env["FOO_THEME"];
      delete process.env["FOO_CONNECT_HOST"];
    }
    const text = t.out.print.join("");
    expect(text).toContain('"dark" (overridden by an environment variable)');
    expect(text).toContain(
      "host  STRING required = (not set; overridden by an environment variable)",
    );
    expect(text).toContain("proxy.port  INTEGER required = 3");
    expect(text).toContain('tags  STRING[] = ["a"]');
    expect(text).toContain("apikey");
  });

  test("command validator", async () => {
    const t = await setup();
    const option = t.get.options[0]!;
    const c = { values: {}, command: t.get, path: "", argument: option };
    expect(option.validate!("theme", c)).toBeUndefined();
    expect(option.validate!("zzz", c)).toContain("valid commands");
  });
});

describe("DefaultConfigurationService", () => {
  test("resolveDefaultSecrets returns the value unchanged without a secret service", async () => {
    const service = new DefaultConfigurationServiceClass(false, jsonFormat);
    expect(await service.resolveDefaultSecrets("__SECRET__:x", "connect")).toBe("__SECRET__:x");
  });

  test("resolveDefaultSecrets resolves stored sentinels and fails on missing secrets", async () => {
    const t = await setup();
    await exec(t.set(), t.context, { command: "connect", option: "token", value: "tok" });
    const stored = t.provider.defaultsData.get("connect") as Values;
    expect(await t.service.resolveDefaultSecrets(stored, "connect")).toEqual({ token: "tok" });
    t.secrets.store.clear();
    await expect(t.service.resolveDefaultSecrets(stored, "connect")).rejects.toThrow(
      "Secret not found",
    );
  });

  test("resolveDefaultSecrets only resolves secrets stored for the same command", async () => {
    const t = await setup();
    await exec(t.set(), t.context, { command: "connect", option: "token", value: "tok" });
    const stored = t.provider.defaultsData.get("connect") as Values;
    await expect(t.service.resolveDefaultSecrets(stored, "other")).rejects.toThrow(
      "does not refer to a secret stored for command",
    );
    await expect(t.service.resolveDefaultSecrets(stored, "connec")).rejects.toThrow(
      "does not refer to a secret stored for command",
    );
    await expect(
      t.service.resolveDefaultSecrets({ token: "__SECRET__:command_Zconnect_Ztoken" }, "connect"),
    ).rejects.toThrow("does not refer to a secret stored for command");
  });

  test("getConfigTargets is empty without a registry", () => {
    const service = new DefaultConfigurationServiceClass(false, jsonFormat);
    expect(service.getConfigTargets().size).toBe(0);
  });

  test("flushIfDirty skips clean state and fails without a location", async () => {
    const service = new DefaultConfigurationServiceClass(false, jsonFormat);
    await service.flushIfDirty(false);
    await expect(service.flushIfDirty(true)).rejects.toThrow("no configLocation");
  });
});
