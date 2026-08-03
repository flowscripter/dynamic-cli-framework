import { describe, expect, test } from "bun:test";
import type { KeyValueService } from "@flowscripter/dynamic-cli-framework-api";
import type {
  FetchInterface,
  NpmjsPluginRepositoryConfig,
  NpmPluginRepositoryConfig,
} from "@flowscripter/dynamic-plugin-framework";
import DefaultPluginService from "../../../src/service/plugin/DefaultPluginService.ts";

function pluginDoc(version: string): Record<string, unknown> {
  return { version, keywords: ["ns"], ns: { extensionPoints: ["some-extension-point"] } };
}

function makeDocFetch(
  handler: (url: string) => { ok: boolean; doc?: Record<string, unknown> },
): FetchInterface {
  return {
    fetch: (input: string) => {
      const result = handler(input);
      return Promise.resolve({
        ok: result.ok,
        json: () => Promise.resolve(result.doc ?? {}),
      } as unknown as Response);
    },
  };
}

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

function makeKeyValueService(data: Record<string, unknown>): KeyValueService {
  return {
    has: (key: string) => Promise.resolve(key in data),
    get: (key: string) => Promise.resolve(data[key]),
    set: () => Promise.resolve(),
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
    await service.applyKeyValueOverrides(makeKeyValueService({ "remotes-config": remotesConfig }));
    expect(service.pluginManager).toBeDefined();
  });

  test("applyKeyValueOverrides applies a local-config override", async () => {
    const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
    const localConfig: NpmPluginRepositoryConfig = {
      nodeModulesPath: "/tmp/override/node_modules",
      packageJsonNamespace: "ns2",
    };
    await service.applyKeyValueOverrides(makeKeyValueService({ "local-config": localConfig }));
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
        "remotes-config": remotesConfig,
        "local-config": localConfig,
      }),
    );
    expect(service.pluginManager).toBeDefined();
  });

  describe("checkAvailable", () => {
    test("resolves true when the package exists and no version is requested", async () => {
      const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
      service.setFetch(makeDocFetch(() => ({ ok: true, doc: pluginDoc("1.0.0") })));

      expect(await service.checkAvailable("@scope/plugin")).toBe(true);
    });

    test("resolves true when the package and requested version both exist", async () => {
      const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
      service.setFetch(makeDocFetch(() => ({ ok: true, doc: pluginDoc("3.0.0") })));

      expect(await service.checkAvailable("@scope/plugin", "3.0.0")).toBe(true);
    });

    test("resolves false when the package exists but the requested version does not", async () => {
      const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
      service.setFetch(makeDocFetch(() => ({ ok: true, doc: pluginDoc("1.0.0") })));

      expect(await service.checkAvailable("@scope/plugin", "9.9.9")).toBe(false);
    });

    test("resolves false when the package does not exist", async () => {
      const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
      service.setFetch(makeDocFetch(() => ({ ok: false })));

      expect(await service.checkAvailable("@scope/missing")).toBe(false);
    });

    test("checks across all configured remotes and succeeds if any one has it", async () => {
      const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
      const remotesConfig: NpmjsPluginRepositoryConfig[] = [
        { name: "first", registryUrl: "https://first.example.com", packageJsonNamespace: "ns" },
        { name: "second", registryUrl: "https://second.example.com", packageJsonNamespace: "ns" },
      ];
      await service.applyKeyValueOverrides({
        has: (key: string) => Promise.resolve(key === "remotes-config"),
        get: () => Promise.resolve(remotesConfig),
        set: () => Promise.resolve(),
      } as unknown as KeyValueService);
      const requestedUrls: string[] = [];
      service.setFetch(
        makeDocFetch((url) => {
          requestedUrls.push(url);
          return { ok: url.startsWith("https://second.example.com"), doc: pluginDoc("1.0.0") };
        }),
      );

      expect(await service.checkAvailable("@scope/plugin")).toBe(true);
      expect(requestedUrls).toEqual([
        "https://first.example.com/@scope/plugin/latest",
        "https://second.example.com/@scope/plugin/latest",
      ]);
    });
  });
});
