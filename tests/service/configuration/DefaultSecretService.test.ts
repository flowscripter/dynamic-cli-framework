import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import DefaultSecretService from "../../../src/service/configuration/DefaultSecretService.ts";

function createMockSecretsApi() {
  return {
    get: mock(() => Promise.resolve(null as string | null)),
    set: mock(() => Promise.resolve()),
    delete: mock(() => Promise.resolve(true)),
  };
}

describe("DefaultSecretService tests", () => {
  let service: DefaultSecretService;
  let mockApi: ReturnType<typeof createMockSecretsApi>;

  beforeEach(() => {
    mockApi = createMockSecretsApi();
    service = new DefaultSecretService("my-test-cli", mockApi);
  });

  afterEach(() => {
    service.clearScope();
  });

  test("Constructor sanitizes service name", async () => {
    const api = createMockSecretsApi();
    const s = new DefaultSecretService("my-cool-cli!", api);
    s.setScope("command_test");
    await s.setSecret("key", "value");
    expect(api.set).toHaveBeenCalledWith({
      service: "my_cool_cli_",
      name: "command_test_key",
      value: "value",
    });
  });

  test("Constructor throws if sanitized service name exceeds 255 chars", () => {
    const api = createMockSecretsApi();
    expect(() => new DefaultSecretService("a".repeat(256), api)).toThrow(
      "exceeds 255 characters",
    );
  });

  test("setSecret throws without scope", async () => {
    await expect(service.setSecret("key", "value")).rejects.toThrow(
      "without a scope",
    );
  });

  test("setSecret constructs correct name and returns it", async () => {
    service.setScope("command_mycommand");
    const name = await service.setSecret("token", "secret123");
    expect(name).toEqual("command_mycommand_token");
    expect(mockApi.set).toHaveBeenCalledWith({
      service: "my_test_cli",
      name: "command_mycommand_token",
      value: "secret123",
    });
  });

  test("setSecret sanitizes scope and key", async () => {
    service.setScope("command_my-cmd");
    const name = await service.setSecret("my-key!", "value");
    expect(name).toEqual("command_my_cmd_my_key_");
    expect(mockApi.set).toHaveBeenCalledWith({
      service: "my_test_cli",
      name: "command_my_cmd_my_key_",
      value: "value",
    });
  });

  test("setSecret throws if name exceeds 255 chars", async () => {
    service.setScope("command_test");
    await expect(
      service.setSecret("a".repeat(250), "value"),
    ).rejects.toThrow("exceeds 255 characters");
  });

  test("setSecret throws if value exceeds 2047 bytes", async () => {
    service.setScope("command_test");
    await expect(
      service.setSecret("key", "a".repeat(2048)),
    ).rejects.toThrow("exceeds 2047 bytes");
  });

  test("getSecret delegates to secrets API", async () => {
    mockApi.get.mockResolvedValueOnce("secret_value");
    const result = await service.getSecret("command_test_key");
    expect(result).toEqual("secret_value");
    expect(mockApi.get).toHaveBeenCalledWith({
      service: "my_test_cli",
      name: "command_test_key",
    });
  });

  test("getSecret returns null when not found", async () => {
    mockApi.get.mockResolvedValueOnce(null);
    const result = await service.getSecret("nonexistent");
    expect(result).toBeNull();
  });

  test("deleteSecret delegates to secrets API", async () => {
    mockApi.delete.mockResolvedValueOnce(true);
    const result = await service.deleteSecret("command_test_key");
    expect(result).toBeTrue();
    expect(mockApi.delete).toHaveBeenCalledWith({
      service: "my_test_cli",
      name: "command_test_key",
    });
  });

  test("deleteSecret returns false when not found", async () => {
    mockApi.delete.mockResolvedValueOnce(false);
    const result = await service.deleteSecret("nonexistent");
    expect(result).toBeFalse();
  });

  test("hasSecret returns true when secret exists", async () => {
    mockApi.get.mockResolvedValueOnce("some_value");
    const result = await service.hasSecret("command_test_key");
    expect(result).toBeTrue();
  });

  test("hasSecret returns false when secret does not exist", async () => {
    mockApi.get.mockResolvedValueOnce(null);
    const result = await service.hasSecret("nonexistent");
    expect(result).toBeFalse();
  });

  test("clearScope resets scope", async () => {
    service.setScope("command_test");
    service.clearScope();
    await expect(service.setSecret("key", "value")).rejects.toThrow(
      "without a scope",
    );
  });

  test("setScope updates scope for subsequent calls", async () => {
    service.setScope("command_cmd1");
    let name = await service.setSecret("key", "value1");
    expect(name).toEqual("command_cmd1_key");

    service.clearScope();
    service.setScope("service_svc1");
    name = await service.setSecret("key", "value2");
    expect(name).toEqual("service_svc1_key");
  });
});
