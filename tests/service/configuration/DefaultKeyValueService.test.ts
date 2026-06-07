import { describe, expect, mock, test } from "bun:test";
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
    const keyValueService = new DefaultKeyValueService();

    keyValueService.setKeyValueData(new Map([["foo", "bar"]]));

    expect(await keyValueService.hasKey("foo")).toBeTrue();
    expect(await keyValueService.getKey("foo")).toEqual("bar");
  });

  test("Cannot set data without clearing", () => {
    const keyValueService = new DefaultKeyValueService();

    keyValueService.setKeyValueData(new Map());
    expect(() => keyValueService.setKeyValueData(new Map())).toThrow();

    keyValueService.clearKeyValueData();
    keyValueService.setKeyValueData(new Map());
  });

  test("Cannot modify data before setting it", async () => {
    const keyValueService = new DefaultKeyValueService();

    expect(keyValueService.setKey("foo", "bar")).rejects.toThrow();
    expect(keyValueService.hasKey("foo")).rejects.toThrow();
    expect(keyValueService.getKey("foo")).rejects.toThrow();
    expect(keyValueService.deleteKey("foo")).rejects.toThrow();

    keyValueService.setKeyValueData(new Map());

    await keyValueService.setKey("foo", "bar");
    expect(await keyValueService.hasKey("foo")).toBeTrue();
    expect(await keyValueService.getKey("foo")).toEqual("bar");
    await keyValueService.deleteKey("foo");
  });

  test("Dirty state is managed correctly", async () => {
    const keyValueService = new DefaultKeyValueService();

    expect(keyValueService.isDirty()).toBeFalse();

    keyValueService.setKeyValueData(new Map());

    expect(keyValueService.isDirty()).toBeFalse();

    await keyValueService.setKey("foo", "bar");

    expect(keyValueService.isDirty()).toBeTrue();

    keyValueService.clearKeyValueData();

    expect(keyValueService.isDirty()).toBeFalse();

    keyValueService.setKeyValueData(new Map([["foo", "bar"]]));

    expect(keyValueService.isDirty()).toBeFalse();

    await keyValueService.deleteKey("foo");

    expect(keyValueService.isDirty()).toBeTrue();
  });

  test("setKey with isSecret=true throws without secret service", async () => {
    const keyValueService = new DefaultKeyValueService();
    keyValueService.setKeyValueData(new Map());

    await expect(keyValueService.setKey("token", "secret", true)).rejects.toThrow(
      "no secret service",
    );
  });

  test("setKey with isSecret=true stores sentinel", async () => {
    const mockApi = createMockSecretsApi();
    const secretService = new DefaultSecretService("test-cli", mockApi);
    secretService.setScope("command_test");
    const keyValueService = new DefaultKeyValueService(secretService);
    keyValueService.setKeyValueData(new Map());

    await keyValueService.setKey("token", "my-secret", true);

    expect(await keyValueService.hasKey("token")).toBeTrue();
    expect(keyValueService.isDirty()).toBeTrue();
    expect(mockApi.set).toHaveBeenCalledTimes(1);
  });

  test("getKey resolves secret sentinel", async () => {
    const mockApi = createMockSecretsApi();
    const secretService = new DefaultSecretService("test-cli", mockApi);
    secretService.setScope("command_test");
    const keyValueService = new DefaultKeyValueService(secretService);
    keyValueService.setKeyValueData(new Map([["token", "__SECRET__:command_test_token"]]));

    mockApi.get.mockResolvedValueOnce("resolved-secret");
    const value = await keyValueService.getKey("token");
    expect(value).toEqual("resolved-secret");
    expect(mockApi.get).toHaveBeenCalledWith({
      service: "test_cli",
      name: "command_test_token",
    });
  });

  test("getKey throws when secret not found in OS store", async () => {
    const mockApi = createMockSecretsApi();
    const secretService = new DefaultSecretService("test-cli", mockApi);
    secretService.setScope("command_test");
    const keyValueService = new DefaultKeyValueService(secretService);
    keyValueService.setKeyValueData(new Map([["token", "__SECRET__:command_test_token"]]));

    mockApi.get.mockResolvedValueOnce(null);
    await expect(keyValueService.getKey("token")).rejects.toThrow("Secret not found");
  });

  test("getKey with sentinel throws without secret service", async () => {
    const keyValueService = new DefaultKeyValueService();
    keyValueService.setKeyValueData(new Map([["token", "__SECRET__:command_test_token"]]));

    await expect(keyValueService.getKey("token")).rejects.toThrow("no secret service");
  });

  test("deleteKey removes secret from OS store", async () => {
    const mockApi = createMockSecretsApi();
    const secretService = new DefaultSecretService("test-cli", mockApi);
    secretService.setScope("command_test");
    const keyValueService = new DefaultKeyValueService(secretService);
    keyValueService.setKeyValueData(new Map([["token", "__SECRET__:command_test_token"]]));

    await keyValueService.deleteKey("token");
    expect(mockApi.delete).toHaveBeenCalledWith({
      service: "test_cli",
      name: "command_test_token",
    });
    expect(await keyValueService.hasKey("token")).toBeFalse();
    expect(keyValueService.isDirty()).toBeTrue();
  });

  test("deleteKey works for non-secret values", async () => {
    const keyValueService = new DefaultKeyValueService();
    keyValueService.setKeyValueData(new Map([["foo", "bar"]]));

    await keyValueService.deleteKey("foo");
    expect(await keyValueService.hasKey("foo")).toBeFalse();
  });
});
