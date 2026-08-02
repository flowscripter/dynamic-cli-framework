import { describe, expect, test } from "bun:test";
import type { KeyValueService } from "@flowscripter/dynamic-cli-framework-api";
import type {
  FetchInterface,
  NpmjsPluginRepositoryConfig,
  NpmPluginRepositoryConfig,
} from "@flowscripter/dynamic-plugin-framework";
import DefaultPluginService from "../../../src/service/plugin/DefaultPluginService.ts";

function makeFetch(handler: (url: string, init?: RequestInit) => { ok: boolean }): FetchInterface {
  return {
    fetch: (input: string, init?: RequestInit) =>
      Promise.resolve(handler(input, init) as unknown as Response),
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

  describe("assertPluginAvailable", () => {
    test("resolves when the package exists and no version is requested", async () => {
      const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
      const requestedUrls: string[] = [];
      service.setFetch(
        makeFetch((url) => {
          requestedUrls.push(url);
          return { ok: true };
        }),
      );

      await service.assertPluginAvailable("@scope/plugin");

      expect(requestedUrls).toEqual(["https://registry.npmjs.org/@scope/plugin"]);
    });

    test("resolves when the package and requested version both exist", async () => {
      const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
      const requestedUrls: string[] = [];
      service.setFetch(
        makeFetch((url) => {
          requestedUrls.push(url);
          return { ok: true };
        }),
      );

      await service.assertPluginAvailable("@scope/plugin", "3.0.0");

      expect(requestedUrls).toEqual([
        "https://registry.npmjs.org/@scope/plugin",
        "https://registry.npmjs.org/@scope/plugin/3.0.0",
      ]);
    });

    test("skips the version check when version is 'latest'", async () => {
      const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
      const requestedUrls: string[] = [];
      service.setFetch(
        makeFetch((url) => {
          requestedUrls.push(url);
          return { ok: true };
        }),
      );

      await service.assertPluginAvailable("@scope/plugin", "latest");

      expect(requestedUrls).toEqual(["https://registry.npmjs.org/@scope/plugin"]);
    });

    test("throws a clear error when the package does not exist", async () => {
      const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
      service.setFetch(makeFetch(() => ({ ok: false })));

      await expect(service.assertPluginAvailable("@scope/missing")).rejects.toThrow(
        "Plugin @scope/missing was not found in the configured plugin registry",
      );
    });

    test("throws a clear error when the package exists but the requested version does not", async () => {
      const service = new DefaultPluginService(getRemoteConfig(), getLocalConfig());
      service.setFetch(makeFetch((url) => ({ ok: !url.endsWith("/9.9.9") })));

      await expect(service.assertPluginAvailable("@scope/plugin", "9.9.9")).rejects.toThrow(
        "Version 9.9.9 of plugin @scope/plugin was not found in the configured plugin registry",
      );
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
        makeFetch((url) => {
          requestedUrls.push(url);
          return { ok: url === "https://second.example.com/@scope/plugin" };
        }),
      );

      await service.assertPluginAvailable("@scope/plugin");

      expect(requestedUrls).toEqual([
        "https://first.example.com/@scope/plugin",
        "https://second.example.com/@scope/plugin",
      ]);
    });

    test("sends a Bearer Authorization header when authToken is configured", async () => {
      const remoteConfig: NpmjsPluginRepositoryConfig = {
        ...getRemoteConfig(),
        authToken: "secret-token",
      };
      const service = new DefaultPluginService(remoteConfig, getLocalConfig());
      const sentAuthHeaders: Array<string | null> = [];
      service.setFetch({
        fetch: (_input: string, init?: RequestInit) => {
          sentAuthHeaders.push((init!.headers as Headers).get("Authorization"));
          return Promise.resolve({ ok: true } as unknown as Response);
        },
      });

      await service.assertPluginAvailable("@scope/plugin");

      expect(sentAuthHeaders).toEqual(["Bearer secret-token"]);
    });
  });
});
