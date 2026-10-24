import { beforeEach, describe, expect, mock, test } from "bun:test";
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
    service = new DefaultSecretService("my-test-cli", ["command", "test"], mockApi);
  });

  test("Constructor sanitizes service name and scope", async () => {
    const api = createMockSecretsApi();
    const s = new DefaultSecretService("my-cool-cli!", ["command", "test"], api);
    await s.setSecret("key", "value");
    expect(api.set).toHaveBeenCalledWith({
      service: "my_cool_cli_",
      name: "command_Ztest_Zkey",
      value: "value",
    });
  });

  test("Constructor throws if sanitized service name exceeds 255 chars", () => {
    const api = createMockSecretsApi();
    expect(() => new DefaultSecretService("a".repeat(256), ["command", "test"], api)).toThrow(
      "exceeds 255 characters",
    );
  });

  test("setSecret constructs correct name and returns it", async () => {
    const commandService = new DefaultSecretService(
      "my-test-cli",
      ["command", "mycommand"],
      mockApi,
    );
    const name = await commandService.setSecret("token", "secret123");
    expect(name).toEqual("command_Zmycommand_Ztoken");
    expect(mockApi.set).toHaveBeenCalledWith({
      service: "my_test_cli",
      name: "command_Zmycommand_Ztoken",
      value: "secret123",
    });
  });

  test("setSecret sanitizes scope and key", async () => {
    const commandService = new DefaultSecretService("my-test-cli", ["command", "my-cmd"], mockApi);
    const name = await commandService.setSecret("my-key!", "value");
    expect(name).toEqual("command_Zmy_2D_cmd_Zmy_2D_key_21_");
    expect(mockApi.set).toHaveBeenCalledWith({
      service: "my_test_cli",
      name: "command_Zmy_2D_cmd_Zmy_2D_key_21_",
      value: "value",
    });
  });

  test("setSecret throws if name exceeds 255 chars", async () => {
    await expect(service.setSecret("a".repeat(250), "value")).rejects.toThrow(
      "exceeds 255 characters",
    );
  });

  test("setSecret throws if value exceeds 2047 bytes", async () => {
    await expect(service.setSecret("key", "a".repeat(2048))).rejects.toThrow("exceeds 2047 bytes");
  });

  test("getSecret delegates to secrets API", async () => {
    mockApi.get.mockResolvedValueOnce("secret_value");
    const result = await service.getSecret("command_Ztest_Zkey");
    expect(result).toEqual("secret_value");
    expect(mockApi.get).toHaveBeenCalledWith({
      service: "my_test_cli",
      name: "command_Ztest_Zkey",
    });
  });

  test("getSecret returns null when not found", async () => {
    mockApi.get.mockResolvedValueOnce(null);
    const result = await service.getSecret("nonexistent");
    expect(result).toBeNull();
  });

  test("deleteSecret delegates to secrets API", async () => {
    mockApi.delete.mockResolvedValueOnce(true);
    const result = await service.deleteSecret("command_Ztest_Zkey");
    expect(result).toBeTrue();
    expect(mockApi.delete).toHaveBeenCalledWith({
      service: "my_test_cli",
      name: "command_Ztest_Zkey",
    });
  });

  test("deleteSecret returns false when not found", async () => {
    mockApi.delete.mockResolvedValueOnce(false);
    const result = await service.deleteSecret("nonexistent");
    expect(result).toBeFalse();
  });

  test("hasSecret returns true when secret exists", async () => {
    mockApi.get.mockResolvedValueOnce("some_value");
    const result = await service.hasSecret("command_Ztest_Zkey");
    expect(result).toBeTrue();
  });

  test("hasSecret returns false when secret does not exist", async () => {
    mockApi.get.mockResolvedValueOnce(null);
    const result = await service.hasSecret("nonexistent");
    expect(result).toBeFalse();
  });

  test("two instances with different scopes never share a secret name", async () => {
    const commandService = new DefaultSecretService("my-test-cli", ["command", "cmd1"], mockApi);
    const serviceService = new DefaultSecretService("my-test-cli", ["service", "svc1"], mockApi);

    const name1 = await commandService.setSecret("key", "value1");
    expect(name1).toEqual("command_Zcmd1_Zkey");

    const name2 = await serviceService.setSecret("key", "value2");
    expect(name2).toEqual("service_Zsvc1_Zkey");
  });

  test("names never collide across differently delimited scopes and keys", () => {
    const names = [
      new DefaultSecretService("cli", ["command", "a"], mockApi).secretName("b_c"),
      new DefaultSecretService("cli", ["command", "a_b"], mockApi).secretName("c"),
      new DefaultSecretService("cli", ["command", "a-b"], mockApi).secretName("c"),
      new DefaultSecretService("cli", ["command", "a"], mockApi).secretName(["b", "c"]),
      new DefaultSecretService("cli", ["command", "a"], mockApi).secretName("b.c"),
    ];
    expect(new Set(names).size).toBe(names.length);
  });

  test("ownsSecretName does not match a scope whose name extends this scope's", () => {
    const a = new DefaultSecretService("cli", ["command", "a"], mockApi);
    const ab = new DefaultSecretService("cli", ["command", "a_b"], mockApi);
    expect(a.ownsSecretName(ab.secretName("key"))).toBeFalse();
    expect(ab.ownsSecretName(a.secretName("b_key"))).toBeFalse();
    expect(a.ownsSecretName(a.secretName("key"))).toBeTrue();
  });
});
