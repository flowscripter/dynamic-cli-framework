import process from "node:process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import {
  CONFIGURATION_SERVICE_ID,
  KEY_VALUE_SERVICE_ID,
  PRINTER_SERVICE_ID,
  SHUTDOWN_SERVICE_ID,
  Secret,
  ValueTypeName,
  type Command,
  type KeyValueService,
  type SubCommand,
} from "@flowscripter/dynamic-cli-framework-api";
import ConfigurationServiceProvider from "../../../src/service/configuration/ConfigurationServiceProvider.ts";
import KeyValueServiceProvider from "../../../src/service/configuration/KeyValueServiceProvider.ts";
import type { SecretsApi } from "../../../src/service/configuration/DefaultSecretService.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import DefaultCommandRegistry from "../../../src/runtime/registry/DefaultCommandRegistry.ts";
import ConfigGetSubCommand from "../../../src/service/configuration/command/ConfigGetSubCommand.ts";
import ConfigSetSubCommand from "../../../src/service/configuration/command/ConfigSetSubCommand.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

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

const connect: SubCommand = {
  name: "connect",
  enableConfiguration: true,
  options: [
    { name: "host", type: ValueTypeName.STRING, isOptional: true },
    {
      name: "token",
      type: ValueTypeName.SECRET,
      isOptional: true,
      validate: (v) => ((v as string).length < 100 ? "token too short" : undefined),
    },
  ],
  positionals: [],
  execute: () => Promise.resolve(),
};

async function setup(initial: unknown = {}) {
  const secrets = new FakeSecrets();
  const registry = new DefaultCommandRegistry([connect] as Array<Command>);
  const configProvider = new ConfigurationServiceProvider(
    100,
    false,
    true,
    true,
    undefined,
    registry,
    secrets,
  );
  const kvProvider = new KeyValueServiceProvider(99, configProvider, true, true, secrets);
  const cliConfig = getCLIConfig();
  const context = new DefaultContext(cliConfig);
  context.addServiceInstance(SHUTDOWN_SERVICE_ID, {
    registerTask: () => {},
    enterLongRunningMode: () => {},
    leaveLongRunningMode: () => {},
    interrupt: () => {},
    isShutdownRequested: false,
  });
  const printed: Array<string> = [];
  context.addServiceInstance(PRINTER_SERVICE_ID, {
    info: () => Promise.resolve(),
    warn: () => Promise.resolve(),
    print: (m: string) => (printed.push(m), Promise.resolve()),
  });
  const folder = await fs.mkdtemp(path.join(tmpdir(), "isolation-"));
  const location = path.join(folder, "config.json");
  await fs.writeFile(location, JSON.stringify(initial));
  configProvider.setConfigLocation(location);
  const info = await configProvider.getServiceInfo(cliConfig);
  context.addServiceInstance(CONFIGURATION_SERVICE_ID, info.service);
  await kvProvider.getServiceInfo(cliConfig);
  await configProvider.initService(context);
  await kvProvider.initService(context);
  const scoped = (name: string) =>
    kvProvider
      .getContextForScope(context, "command", name)
      .getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService;
  return { secrets, configProvider, context, location, scoped, info, printed };
}

describe("registered configuration service", () => {
  test("exposes only configLocation and setConfigLocation", async () => {
    const { context, location } = await setup({
      defaults: { connect: { host: "h" } },
      "key-values": { commands: { other: { k: "v" } } },
    });
    const service = context.getServiceById(CONFIGURATION_SERVICE_ID) as Record<string, unknown>;
    const members = new Set<string>();
    for (
      let o: object | null = service;
      o && o !== Object.prototype;
      o = Object.getPrototypeOf(o)
    ) {
      Object.getOwnPropertyNames(o).forEach((n) => members.add(n));
    }
    members.delete("constructor");
    expect([...members].sort()).toEqual(["configLocation", "setConfigLocation"]);
    expect(service["configLocation"]).toBe(location);
    for (const name of [
      "getKeyValueData",
      "defaultsData",
      "resolveDefaultSecrets",
      "getConfigString",
      "getMaskedConfigString",
      "commitDefault",
      "flushIfDirty",
      "getConfigTargets",
    ]) {
      expect(service[name]).toBeUndefined();
    }
  });
});

describe("key-value secret scoping", () => {
  test("a command cannot read another command's secret via a forged sentinel", async () => {
    const { scoped, secrets } = await setup();
    await scoped("victim").set("api", new Secret("victim-secret"));
    expect([...secrets.store.values()]).toEqual(['"victim-secret"']);
    const victimName = [...secrets.store.keys()][0]!;

    const attacker = scoped("attacker");
    await attacker.set("stolen", `__SECRET__:${victimName}`);
    await expect(attacker.get("stolen")).rejects.toThrow();
  });

  test("a command cannot delete another command's secret via a forged sentinel", async () => {
    const { scoped, secrets } = await setup();
    await scoped("victim").set("api", new Secret("victim-secret"));
    const victimName = [...secrets.store.keys()][0]!;

    const attacker = scoped("attacker");
    await attacker.set("stolen", `__SECRET__:${victimName}`);
    await attacker.delete("stolen");
    expect(secrets.store.size).toBe(1);
  });

  test("a command cannot read a stored default secret via a forged sentinel", async () => {
    const { scoped, secrets } = await setup();
    secrets.store.set("defaults_Zconnect_Ztoken", "default-secret");
    const attacker = scoped("attacker");
    await attacker.set("stolen", "__SECRET__:defaults_Zconnect_Ztoken");
    await expect(attacker.get("stolen")).rejects.toThrow();
  });
});

describe("prototype pollution", () => {
  test("__proto__ and constructor keys in the config file do not pollute Object.prototype", async () => {
    const { configProvider, context, scoped } = await setup();
    await fs.writeFile(
      configProvider.configLocation!,
      '{"defaults":{"__proto__":{"polluted":"yes"},"connect":{"__proto__":{"polluted":"yes"},"host":"h"}},' +
        '"key-values":{"commands":{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}}}}}',
    );
    await configProvider.initService(context);
    const values = (await configProvider.getDefaultArgumentValues(
      getCLIConfig(),
      connect,
    )) as Record<string, unknown>;
    expect(values["host"]).toBe("h");
    expect(values["polluted"]).toBeUndefined();
    await scoped("constructor").has("prototype");
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });
});

describe("secret leakage", () => {
  test("a rejected SECRET value is not echoed in the error", async () => {
    const { configProvider, context } = await setup();
    const set = new ConfigSetSubCommand(configProvider.configurationService);
    const err = await set
      .execute(context, { command: "connect", option: "token", value: "hunter2-secret" })
      .catch((e: Error) => e);
    expect(String(err)).toContain("token too short");
    expect(String(err)).not.toContain("hunter2-secret");
  });

  test("get never prints a stored secret or its sentinel", async () => {
    const { configProvider, context, secrets, printed } = await setup({
      defaults: { connect: { host: "h", token: "__SECRET__:defaults_Zconnect_Ztoken" } },
    });
    secrets.store.set("defaults_Zconnect_Ztoken", "hunter2-secret");
    await configProvider.initService(context);
    await new ConfigGetSubCommand(configProvider.configurationService).execute(context, {});
    const output = printed.join("");
    expect(output).toContain("********");
    expect(output).not.toContain("hunter2-secret");
    expect(output).not.toContain("__SECRET__");
  });
});

describe("config file permissions", () => {
  test.skipIf(process.platform === "win32")(
    "a newly created config file is only accessible by the owner",
    async () => {
      const { configProvider, scoped } = await setup();
      await fs.rm(configProvider.configLocation!);
      const kv = scoped("c");
      await kv.set("k", "v");
      await kv.flush();
      const mode = (await fs.stat(configProvider.configLocation!)).mode & 0o777;
      expect(mode & 0o077).toBe(0);
    },
  );
});
