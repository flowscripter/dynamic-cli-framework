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
  options: { format?: typeof tomlFormat; secrets?: FakeSecrets; stdin?: boolean } = {},
) {
  const registry = new DefaultCommandRegistry([
    themeCommand,
    connectCommand,
    hiddenCommand,
  ] as Array<Command>);
  const secrets = options.secrets ?? new FakeSecrets();
  const provider = new ConfigurationServiceProvider(
    100,
    false,
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
  const service = (await provider.getServiceInfo(cliConfig)).service as DefaultConfigurationService;
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

const exec = (cmd: SubCommand, ctx: DefaultContext, values: Values) => cmd.execute(ctx, values);

describe("config set", () => {
  test("sets a global command value and creates the default file", async () => {
    const t = await setup();
    await exec(t.set(), t.context as DefaultContext, { command: "theme", value: "dark" });
    expect(t.provider.defaultsData.get("theme")).toEqual("dark");
    const file = JSON.parse(await fs.readFile(path.join(home, ".foo.json"), "utf8"));
    expect(file).toEqual({ defaults: { theme: "dark" } });
  });

  test("rejects values failing the declared constraints and does not write", async () => {
    const t = await setup();
    await expect(
      exec(t.set(), t.context as DefaultContext, { command: "theme", value: "pink" }),
    ).rejects.toThrow();
    await expect(
      exec(t.set(), t.context as DefaultContext, {
        command: "connect",
        option: "port",
        value: "99999",
      }),
    ).rejects.toThrow();
    await expect(
      exec(t.set(), t.context as DefaultContext, {
        command: "connect",
        option: "port",
        value: "abc",
      }),
    ).rejects.toThrow();
    expect(t.provider.defaultsData.size).toBe(0);
    await expect(fs.stat(path.join(home, ".foo.json"))).rejects.toThrow();
  });

  test("sets only the given option with typed conversion, no required check", async () => {
    const t = await setup();
    const ctx = t.context as DefaultContext;
    await exec(t.set(), ctx, { command: "connect", option: "port", value: "8080" });
    await exec(t.set(), ctx, { command: "connect", option: "secure", value: "TRUE" });
    expect(t.provider.defaultsData.get("connect")).toEqual({ port: 8080, secure: true });
  });

  test("sets nested, array element and whole values", async () => {
    const t = await setup();
    const ctx = t.context as DefaultContext;
    await exec(t.set(), ctx, { command: "connect", option: "proxy.port", value: "3128" });
    await exec(t.set(), ctx, { command: "connect", option: "tags", value: '["a","b"]' });
    await exec(t.set(), ctx, { command: "connect", option: "tags[2]", value: "c" });
    expect(t.provider.defaultsData.get("connect")).toEqual({
      proxy: { port: 3128 },
      tags: ["a", "b", "c"],
    });
    await expect(
      exec(t.set(), ctx, { command: "connect", option: "tags[5]", value: "x" }),
    ).rejects.toThrow("sparse");
    await expect(
      exec(t.set(), ctx, { command: "connect", option: "proxy", value: "nope" }),
    ).rejects.toThrow("JSON");
    await exec(t.set(), ctx, { command: "connect", option: "proxy", value: '{"host":"h"}' });
    expect(t.provider.defaultsData.get("connect")).toMatchObject({ proxy: { host: "h" } });
  });

  test("unknown command, option and non-configurable command fail", async () => {
    const t = await setup();
    const ctx = t.context as DefaultContext;
    await expect(
      exec(t.set(), ctx, { command: "hidden", option: "x", value: "1" }),
    ).rejects.toThrow();
    await expect(
      exec(t.set(), ctx, { command: "connect", option: "nope", value: "1" }),
    ).rejects.toThrow("valid options");
    await expect(
      exec(t.set(), ctx, { command: "theme", option: "x", value: "1" }),
    ).rejects.toThrow();
  });

  test("fails listing missing items when prompting is not available", async () => {
    const t = await setup();
    await expect(exec(t.set(), t.context as DefaultContext, {})).rejects.toThrow("--command");
    await expect(
      exec(t.set(), t.context as DefaultContext, { command: "connect" }),
    ).rejects.toThrow("host, port");
  });

  test("prompts for mandatory options when only the command is given", async () => {
    const t = await setup();
    const calls: Array<string> = [];
    t.context.addServiceInstance(ARGUMENT_PROMPTER_SERVICE_ID, {
      promptForArguments: (args: ReadonlyArray<{ name: string }>) => {
        calls.push(args.map((a) => a.name).join(","));
        return Promise.resolve({ host: "example.com", port: 22 });
      },
    });
    await exec(t.set(), t.context as DefaultContext, { command: "connect" });
    expect(calls).toEqual(["host,port"]);
    expect(t.provider.defaultsData.get("connect")).toEqual({ host: "example.com", port: 22 });
  });

  test("prompts for the value when only the option is given", async () => {
    const t = await setup();
    t.context.addServiceInstance(ARGUMENT_PROMPTER_SERVICE_ID, {
      promptForArguments: () => Promise.resolve({ secure: false }),
    });
    await exec(t.set(), t.context as DefaultContext, { command: "connect", option: "secure" });
    expect(t.provider.defaultsData.get("connect")).toEqual({ secure: false });
  });

  test("validators report problems at parse time", async () => {
    const t = await setup();
    const set = t.set();
    const [command, option, value, stdin] = set.options;
    const ctx = (values: Values) => ({ values, command: set, path: "", argument: command! });
    expect(command!.validate!("theme", ctx({}))).toBeUndefined();
    expect(command!.validate!("nope", ctx({}))).toContain("unknown");
    expect(option!.validate!("port", ctx({ command: "connect" }))).toBeUndefined();
    expect(option!.validate!("bad", ctx({ command: "connect" }))).toContain("unknown option");
    expect(value!.validate!("99999", ctx({ command: "connect", option: "port" }))).toContain(
      "port",
    );
    expect(value!.validate!("80", ctx({ command: "connect", option: "port" }))).toBeUndefined();
    expect(value!.validate!("x", ctx({ command: "connect" }))).toContain("--option");
    expect(stdin!.validate!(true, ctx({ value: "x" }))).toContain("--value");
  });
});

describe("config set with SECRET options", () => {
  test("stores the secret in the secret store and only the sentinel in the file", async () => {
    const t = await setup();
    await exec(t.set(), t.context as DefaultContext, {
      command: "connect",
      option: "token",
      value: "s3cret",
    });
    const stored = (t.provider.defaultsData.get("connect") as Values)["token"] as string;
    expect(stored.startsWith("__SECRET__:")).toBe(true);
    expect([...t.secrets.store.values()]).toEqual(["s3cret"]);
    expect(await fs.readFile(path.join(home, ".foo.json"), "utf8")).not.toContain("s3cret");
  });

  test("warns when passed as an argument on an interactive stdin only", async () => {
    const interactive = await setup({ stdin: true });
    await exec(interactive.set(), interactive.context as DefaultContext, {
      command: "connect",
      option: "token",
      value: "a",
    });
    expect(interactive.out.warn.join("")).toContain("--value-stdin");
    expect(interactive.out.warn.join("")).not.toContain("a\n");

    const piped = await setup();
    await exec(piped.set(), piped.context as DefaultContext, {
      command: "connect",
      option: "token",
      value: "a",
    });
    expect(piped.out.warn).toEqual([]);
  });

  test("--value-stdin reads the value, strips one trailing newline, and does not warn", async () => {
    const t = await setup();
    await exec(t.set("piped\n"), t.context as DefaultContext, {
      command: "connect",
      option: "token",
      "value-stdin": true,
    });
    expect([...t.secrets.store.values()]).toEqual(["piped"]);
    expect(t.out.warn).toEqual([]);
  });

  test("--value-stdin fails on empty stdin and on a TTY stdin", async () => {
    const t = await setup();
    await expect(
      exec(t.set(""), t.context as DefaultContext, {
        command: "connect",
        option: "token",
        "value-stdin": true,
      }),
    ).rejects.toThrow("stdin");
    const tty = await setup({ stdin: true });
    await expect(
      exec(tty.set("x"), tty.context as DefaultContext, {
        command: "connect",
        option: "token",
        "value-stdin": true,
      }),
    ).rejects.toThrow("piped");
  });

  test("overwriting replaces in place, unset deletes the secret", async () => {
    const t = await setup();
    const ctx = t.context as DefaultContext;
    const args = { command: "connect", option: "token" };
    await exec(t.set(), ctx, { ...args, value: "one" });
    await exec(t.set(), ctx, { ...args, value: "two" });
    expect([...t.secrets.store.values()]).toEqual(["two"]);
    await exec(t.unset, ctx, args);
    expect(t.secrets.store.size).toBe(0);
    expect(t.provider.defaultsData.has("connect")).toBe(false);
  });

  test("a failed file write restores memory and the secret store", async () => {
    const t = await setup();
    const ctx = t.context as DefaultContext;
    await exec(t.set(), ctx, { command: "connect", option: "token", value: "one" });
    t.provider.configLocation = path.join(home, "missing-dir", "x.json");
    await expect(
      exec(t.set(), ctx, { command: "connect", option: "token", value: "two" }),
    ).rejects.toThrow();
    expect([...t.secrets.store.values()]).toEqual(["one"]);
    expect((t.provider.defaultsData.get("connect") as Values)["token"] as string).toContain(
      "__SECRET__:",
    );
  });

  test("refuses when the secret service is not enabled", async () => {
    const registry = new DefaultCommandRegistry([connectCommand] as Array<Command>);
    const provider = new ConfigurationServiceProvider(100, false, true, false, undefined, registry);
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);
    context.addServiceInstance(PRINTER_SERVICE_ID, {
      info: () => Promise.resolve(),
      warn: () => Promise.resolve(),
    });
    const service = (await provider.getServiceInfo(cliConfig))
      .service as DefaultConfigurationService;
    await provider.initService(context);
    await expect(
      new ConfigSetSubCommand(service).execute(context, {
        command: "connect",
        option: "token",
        value: "x",
      }),
    ).rejects.toThrow("secret service");
  });

  test("whole-value JSON for an option containing secrets is rejected", async () => {
    const complexSecret: SubCommand = {
      name: "cs",
      enableConfiguration: true,
      options: [
        {
          name: "creds",
          type: ComplexValueTypeName.COMPLEX,
          isOptional: true,
          properties: [{ name: "pw", type: ValueTypeName.SECRET }],
        },
      ],
      positionals: [],
      execute: () => Promise.resolve(),
    };
    const registry = new DefaultCommandRegistry([complexSecret] as Array<Command>);
    const provider = new ConfigurationServiceProvider(
      100,
      false,
      true,
      true,
      undefined,
      registry,
      new FakeSecrets(),
    );
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);
    context.addServiceInstance(PRINTER_SERVICE_ID, {});
    const service = (await provider.getServiceInfo(cliConfig))
      .service as DefaultConfigurationService;
    await expect(
      new ConfigSetSubCommand(service).execute(context, {
        command: "cs",
        option: "creds",
        value: '{"pw":"x"}',
      }),
    ).rejects.toThrow("SECRET");
  });
});

describe("config unset", () => {
  test("removes an option, prunes empty parents and then the command entry", async () => {
    const t = await setup();
    const ctx = t.context as DefaultContext;
    await exec(t.set(), ctx, { command: "connect", option: "proxy.port", value: "1" });
    await exec(t.set(), ctx, { command: "connect", option: "port", value: "2" });
    await exec(t.unset, ctx, { command: "connect", option: "proxy.port" });
    expect(t.provider.defaultsData.get("connect")).toEqual({ port: 2 });
    await exec(t.unset, ctx, { command: "connect", option: "port" });
    expect(t.provider.defaultsData.has("connect")).toBe(false);
  });

  test("removes all defaults of a command and is a no-op when nothing is stored", async () => {
    const t = await setup();
    const ctx = t.context as DefaultContext;
    await exec(t.unset, ctx, { command: "theme" });
    expect(t.out.info.join("")).toContain("Nothing to unset");
    await exec(t.set(), ctx, { command: "theme", value: "dark" });
    await exec(t.unset, ctx, { command: "theme" });
    expect(t.provider.defaultsData.has("theme")).toBe(false);
  });

  test("array elements cannot be unset", async () => {
    const t = await setup();
    const ctx = t.context as DefaultContext;
    await exec(t.set(), ctx, { command: "connect", option: "tags", value: '["a"]' });
    await expect(exec(t.unset, ctx, { command: "connect", option: "tags[0]" })).rejects.toThrow();
    const option = t.unset.options[1]!;
    expect(
      option.validate!("tags[0]", {
        values: { command: "connect" },
        command: t.unset,
        path: "",
        argument: option,
      }),
    ).toContain("array element");
  });
});

describe("config get and dump masking", () => {
  test("lists configurable commands, values and flags unknown entries; masks secrets", async () => {
    const t = await setup();
    const ctx = t.context as DefaultContext;
    await exec(t.set(), ctx, { command: "connect", option: "token", value: "s3cret" });
    await exec(t.set(), ctx, { command: "connect", option: "port", value: "22" });
    t.provider.defaultsData.set("gone", { a: 1 });
    (t.provider.defaultsData.get("connect") as Values)["old"] = "x";
    (t.provider.defaultsData.get("connect") as Values)["host"] = 5;

    await exec(t.get, ctx, {});
    const text = t.out.print.join("");
    expect(text).toContain("theme");
    expect(text).toContain("one of: dark, light");
    expect(text).toContain("port  INTEGER required (range: 1..65535) = 22");
    expect(text).toContain('token  SECRET = "********"');
    expect(text).not.toContain("s3cret");
    expect(text).not.toContain("__SECRET__");
    expect(text).toContain("(unknown option)");
    expect(text).toContain("gone  (unknown command");
    expect(text).toContain("(type mismatch)");
    expect(text).not.toContain("hidden");

    t.out.print.length = 0;
    await exec(t.get, ctx, { command: "theme" });
    expect(t.out.print.join("")).toContain("(not set)");
    expect(t.out.print.join("")).not.toContain("connect");
  });

  test("masks plaintext in SECRET options and sentinels in the dump", async () => {
    const t = await setup();
    t.provider.defaultsData.set("connect", { token: "plain", host: "h" });
    const dumped = JSON.parse(t.service.getMaskedConfigString());
    expect(dumped.defaults.connect).toEqual({ token: "********", host: "h" });
    expect(t.provider.getConfigString()).toContain("plain");
  });
});

describe("config set write-back", () => {
  test("TOML keeps comments", async () => {
    await fs.writeFile(
      path.join(home, ".foo.toml"),
      '# my config\n[defaults.connect]\nhost = "a" # the host\n',
    );
    const t = await setup({ format: tomlFormat });
    await exec(t.set(), t.context as DefaultContext, {
      command: "connect",
      option: "port",
      value: "5",
    });
    const text = await fs.readFile(path.join(home, ".foo.toml"), "utf8");
    expect(text).toContain("# my config");
    expect(text).toContain("# the host");
    expect(tomlFormat.parse(text).data).toEqual({ defaults: { connect: { host: "a", port: 5 } } });
  });
});

describe("registration", () => {
  test("get, set, unset and dump are members of the config group when a registry is provided", async () => {
    const registry = new DefaultCommandRegistry([]);
    const provider = new ConfigurationServiceProvider(100, false, true, false, undefined, registry);
    const info = await provider.getServiceInfo(getCLIConfig());
    const group = info.commands.find(
      (c) => c.name === "config" && "memberSubCommands" in c,
    ) as unknown as {
      memberSubCommands: Array<{ name: string }>;
    };
    expect(group.memberSubCommands.map((m) => m.name)).toEqual(["dump", "get", "set", "unset"]);

    const noRegistry = new ConfigurationServiceProvider(100, false, true);
    const info2 = await noRegistry.getServiceInfo(getCLIConfig());
    const group2 = info2.commands.find((c) => "memberSubCommands" in c) as unknown as {
      memberSubCommands: Array<{ name: string }>;
    };
    expect(group2.memberSubCommands.map((m) => m.name)).toEqual(["dump"]);
  });
});
