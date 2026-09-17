import { describe, expect, mock, test } from "bun:test";
import { Secret } from "@flowscripter/dynamic-cli-framework-api";
import DefaultKeyValueService from "../../../src/service/configuration/DefaultKeyValueService.ts";
import DefaultSecretService from "../../../src/service/configuration/DefaultSecretService.ts";

function createMockSecretsApi() {
  return {
    get: mock(() => Promise.resolve(null as string | null)),
    set: mock(() => Promise.resolve()),
    delete: mock(() => Promise.resolve(true)),
  };
}

describe("DefaultKeyValueService tests", () => {
  test("Setting data works", async () => {
    const keyValueService = new DefaultKeyValueService(new Map([["foo", "bar"]]));

    expect(await keyValueService.has("foo")).toBeTrue();
    expect(await keyValueService.get("foo")).toEqual("bar");
  });

  test("Dirty state is managed correctly", async () => {
    const keyValueService = new DefaultKeyValueService(new Map());

    expect(keyValueService.isDirty()).toBeFalse();

    await keyValueService.set("foo", "bar");

    expect(keyValueService.isDirty()).toBeTrue();

    const secondKeyValueService = new DefaultKeyValueService(new Map([["foo", "bar"]]));

    expect(secondKeyValueService.isDirty()).toBeFalse();

    await secondKeyValueService.delete("foo");

    expect(secondKeyValueService.isDirty()).toBeTrue();
  });

  test("set with a Secret-wrapped value throws without secret service", async () => {
    const keyValueService = new DefaultKeyValueService(new Map());

    await expect(keyValueService.set("token", new Secret("secret"))).rejects.toThrow(
      "no secret service",
    );
  });

  test("set with a Secret-wrapped value stores sentinel", async () => {
    const mockApi = createMockSecretsApi();
    const secretService = new DefaultSecretService("test-cli", "command_test", mockApi);
    const keyValueService = new DefaultKeyValueService(new Map(), secretService);

    await keyValueService.set("token", new Secret("my-secret"));

    expect(await keyValueService.has("token")).toBeTrue();
    expect(keyValueService.isDirty()).toBeTrue();
    expect(mockApi.set).toHaveBeenCalledTimes(1);
    expect(mockApi.set).toHaveBeenCalledWith({
      service: "test_cli",
      name: "command_test_token",
      value: JSON.stringify("my-secret"),
    });
  });

  test("get resolves secret sentinel", async () => {
    const mockApi = createMockSecretsApi();
    const secretService = new DefaultSecretService("test-cli", "command_test", mockApi);
    const keyValueService = new DefaultKeyValueService(
      new Map([["token", "__SECRET__:command_test_token"]]),
      secretService,
    );

    mockApi.get.mockResolvedValueOnce(JSON.stringify("resolved-secret"));
    const value = await keyValueService.get("token");
    expect(value).toEqual("resolved-secret");
    expect(mockApi.get).toHaveBeenCalledWith({
      service: "test_cli",
      name: "command_test_token",
    });
  });

  test("get throws when secret not found in OS store", async () => {
    const mockApi = createMockSecretsApi();
    const secretService = new DefaultSecretService("test-cli", "command_test", mockApi);
    const keyValueService = new DefaultKeyValueService(
      new Map([["token", "__SECRET__:command_test_token"]]),
      secretService,
    );

    mockApi.get.mockResolvedValueOnce(null);
    await expect(keyValueService.get("token")).rejects.toThrow("Secret not found");
  });

  test("get with sentinel throws without secret service", async () => {
    const keyValueService = new DefaultKeyValueService(
      new Map([["token", "__SECRET__:command_test_token"]]),
    );

    await expect(keyValueService.get("token")).rejects.toThrow("no secret service");
  });

  test("delete removes secret from OS store", async () => {
    const mockApi = createMockSecretsApi();
    const secretService = new DefaultSecretService("test-cli", "command_test", mockApi);
    const keyValueService = new DefaultKeyValueService(
      new Map([["token", "__SECRET__:command_test_token"]]),
      secretService,
    );

    await keyValueService.delete("token");
    expect(mockApi.delete).toHaveBeenCalledWith({
      service: "test_cli",
      name: "command_test_token",
    });
    expect(await keyValueService.has("token")).toBeFalse();
    expect(keyValueService.isDirty()).toBeTrue();
  });

  test("delete works for non-secret values", async () => {
    const keyValueService = new DefaultKeyValueService(new Map([["foo", "bar"]]));

    await keyValueService.delete("foo");
    expect(await keyValueService.has("foo")).toBeFalse();
  });

  test("set with a Secret-wrapped non-string (object) value, get recovers it", async () => {
    const mockApi = createMockSecretsApi();
    const secretService = new DefaultSecretService("test-cli", "command_test", mockApi);
    const keyValueService = new DefaultKeyValueService(new Map(), secretService);

    const original = { user: "alice", tokens: [1, 2, 3], nested: { active: true } };
    await keyValueService.set("creds", new Secret(original));

    expect(mockApi.set).toHaveBeenCalledTimes(1);
    const setCall = mockApi.set.mock.calls[0] as unknown as [{ value: string }];
    expect(JSON.parse(setCall[0].value)).toEqual(original);

    mockApi.get.mockResolvedValueOnce(setCall[0].value);
    const recovered = await keyValueService.get("creds");
    expect(recovered).toEqual(original);
  });

  test("get recursively resolves a hand-embedded nested sentinel in a plain object value", async () => {
    const mockApi = createMockSecretsApi();
    const secretService = new DefaultSecretService("test-cli", "command_test", mockApi);
    const keyValueService = new DefaultKeyValueService(
      new Map([
        [
          "config",
          {
            plain: "value",
            list: ["a", "__SECRET__:command_test_nested"],
            nested: { token: "__SECRET__:command_test_nested" },
          },
        ],
      ]),
      secretService,
    );

    mockApi.get.mockResolvedValue("resolved-nested-secret");
    const value = await keyValueService.get("config");
    expect(value).toEqual({
      plain: "value",
      list: ["a", "resolved-nested-secret"],
      nested: { token: "resolved-nested-secret" },
    });
  });

  test("set with a Secret wrapped two levels deep inside a larger object", async () => {
    const mockApi = createMockSecretsApi();
    const secretService = new DefaultSecretService("test-cli", "command_test", mockApi);
    const keyValueService = new DefaultKeyValueService(new Map(), secretService);

    await keyValueService.set("config", {
      plain: "value",
      auth: {
        credentials: new Secret({ user: "alice", pass: "hunter2" }),
      },
    });

    expect(mockApi.set).toHaveBeenCalledTimes(1);
    const setCall = mockApi.set.mock.calls[0] as unknown as [
      { service: string; name: string; value: string },
    ];
    expect(setCall[0]).toEqual({
      service: "test_cli",
      name: "command_test_config_auth_credentials",
      value: JSON.stringify({ user: "alice", pass: "hunter2" }),
    });

    mockApi.get.mockResolvedValueOnce(setCall[0].value);
    const resolved = await keyValueService.get<{
      plain: string;
      auth: { credentials: { user: string; pass: string } };
    }>("config");
    expect(resolved).toEqual({
      plain: "value",
      auth: { credentials: { user: "alice", pass: "hunter2" } },
    });
    expect(mockApi.get).toHaveBeenLastCalledWith({
      service: "test_cli",
      name: "command_test_config_auth_credentials",
    });
  });

  test("delete cleans up a secret nested two levels deep inside a larger object", async () => {
    const mockApi = createMockSecretsApi();
    const secretService = new DefaultSecretService("test-cli", "command_test", mockApi);
    const keyValueService = new DefaultKeyValueService(new Map(), secretService);

    await keyValueService.set("config", {
      plain: "value",
      auth: {
        credentials: new Secret({ user: "alice", pass: "hunter2" }),
      },
    });

    await keyValueService.delete("config");

    expect(mockApi.delete).toHaveBeenCalledTimes(1);
    expect(mockApi.delete).toHaveBeenCalledWith({
      service: "test_cli",
      name: "command_test_config_auth_credentials",
    });
    expect(await keyValueService.has("config")).toBeFalse();
  });
});
