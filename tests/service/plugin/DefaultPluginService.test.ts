import { describe, expect, test } from "bun:test";
import type { KeyValueService } from "@flowscripter/dynamic-cli-framework-api";
import type {
  NpmjsPluginRepositoryConfig,
  NpmPluginRepositoryConfig,
} from "@flowscripter/dynamic-plugin-framework";
import DefaultPluginService from "../../../src/service/plugin/DefaultPluginService.ts";

function getRemoteConfig(): NpmjsPluginRepositoryConfig {
  return {
    name: "default-remote",
    registryUrl: "https://registry.npmjs.org",
    packageJsonNamespace: "ns",
  };
}

function getLocalConfig(): NpmPluginRepositoryConfig {
  return { nodeModulesPath: "/tmp/default/node_modules", packageJsonNamespace: "ns" };
}

function makeKeyValueService(data: Record<string, string>): KeyValueService {
  return {
    hasKey: (key: string) => Promise.resolve(key in data),
    getKey: (key: string) => Promise.resolve(data[key] ?? ""),
    setKey: () => Promise.resolve(),
  } as unknown as KeyValueService;
}

describe("DefaultPluginService", () => {
  test("constructs a pluginManager from the provided remote and local configs", () => {
    const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
    expect(service.pluginManager).toBeDefined();
  });

  test("applyKeyValueOverrides with no overrides keeps the default configs", async () => {
    const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
    const original = service.pluginManager;
    await service.applyKeyValueOverrides(makeKeyValueService({}));
    expect(service.pluginManager).not.toBe(original);
    expect(service.pluginManager).toBeDefined();
  });

  test("applyKeyValueOverrides applies a remotes-config override", async () => {
    const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
    const remotesConfig: NpmjsPluginRepositoryConfig[] = [
      { name: "override-remote", registryUrl: "https://example.com", packageJsonNamespace: "ns2" },
    ];
    await service.applyKeyValueOverrides(
      makeKeyValueService({ "remotes-config": JSON.stringify(remotesConfig) }),
    );
    expect(service.pluginManager).toBeDefined();
  });

  test("applyKeyValueOverrides applies a local-config override", async () => {
    const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
    const localConfig: NpmPluginRepositoryConfig = {
      nodeModulesPath: "/tmp/override/node_modules",
      packageJsonNamespace: "ns2",
    };
    await service.applyKeyValueOverrides(
      makeKeyValueService({ "local-config": JSON.stringify(localConfig) }),
    );
    expect(service.pluginManager).toBeDefined();
  });

  test("applyKeyValueOverrides applies both remotes-config and local-config overrides", async () => {
    const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
    const remotesConfig: NpmjsPluginRepositoryConfig[] = [
      { name: "override-remote", registryUrl: "https://example.com", packageJsonNamespace: "ns2" },
    ];
    const localConfig: NpmPluginRepositoryConfig = {
      nodeModulesPath: "/tmp/override/node_modules",
      packageJsonNamespace: "ns2",
    };
    await service.applyKeyValueOverrides(
      makeKeyValueService({
        "remotes-config": JSON.stringify(remotesConfig),
        "local-config": JSON.stringify(localConfig),
      }),
    );
    expect(service.pluginManager).toBeDefined();
  });
});
