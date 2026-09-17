import type {
  ValueNode,
  KeyValueService,
  SettableValueNode,
} from "@flowscripter/dynamic-cli-framework-api";
import { Secret, SECRET_SENTINEL_PREFIX } from "@flowscripter/dynamic-cli-framework-api";
import type DefaultSecretService from "./DefaultSecretService.ts";
import resolveSecrets from "./resolveSecrets.ts";

/**
 * Bound permanently to a single scope's data at construction - never re-pointed afterward. Create
 * a separate instance per scope (see {@link KeyValueServiceProvider.getScopedKeyValueService}),
 * rather than sharing one instance across scopes.
 */
export default class DefaultKeyValueService implements KeyValueService {
  readonly #keyValueData: Map<string, ValueNode>;
  #dirty = false;
  readonly #secretService: DefaultSecretService | undefined;

  constructor(keyValueData: Map<string, ValueNode>, secretService?: DefaultSecretService) {
    this.#keyValueData = keyValueData;
    this.#secretService = secretService;
  }

  public isDirty(): boolean {
    return this.#dirty;
  }

  public async get<T extends ValueNode = ValueNode>(key: string): Promise<T> {
    const value = this.#keyValueData.get(key);
    if (value === undefined) {
      throw new Error("Attempt to access unknown key");
    }

    const resolveSecret = async (bunSecretName: string): Promise<unknown> => {
      if (!this.#secretService) {
        throw new Error("Secret sentinel found but no secret service is available");
      }
      const secretValue = await this.#secretService.getSecret(bunSecretName);
      if (secretValue === null) {
        throw new Error(`Secret not found in OS secret store for key: '${key}'`);
      }
      try {
        return JSON.parse(secretValue);
      } catch {
        return secretValue;
      }
    };

    return resolveSecrets(value, resolveSecret) as Promise<T>;
  }

  public has(key: string): Promise<boolean> {
    return Promise.resolve(this.#keyValueData.has(key));
  }

  public async set(key: string, value: SettableValueNode): Promise<void> {
    this.#keyValueData.set(key, await this.#storeSecrets(key, value, []));
    this.#dirty = true;
  }

  async #storeSecrets(
    key: string,
    value: SettableValueNode,
    path: Array<string>,
  ): Promise<ValueNode> {
    if (value instanceof Secret) {
      if (!this.#secretService) {
        throw new Error("Attempt to set a secret but no secret service is available");
      }
      const secretName = [key, ...path].join("_");
      const bunSecretName = await this.#secretService.setSecret(
        secretName,
        JSON.stringify(value.value),
      );
      return SECRET_SENTINEL_PREFIX + bunSecretName;
    }
    if (Array.isArray(value)) {
      const result: Array<ValueNode> = [];
      for (let i = 0; i < value.length; i += 1) {
        result.push(await this.#storeSecrets(key, value[i]!, [...path, String(i)]));
      }
      return result as ValueNode;
    }
    if (typeof value === "object" && value !== null) {
      const result: Record<string, ValueNode> = {};
      for (const [propertyName, propertyValue] of Object.entries(value)) {
        result[propertyName] = await this.#storeSecrets(key, propertyValue, [
          ...path,
          propertyName,
        ]);
      }
      return result as ValueNode;
    }
    return value;
  }

  public async delete(key: string): Promise<void> {
    const value = this.#keyValueData.get(key);
    if (value !== undefined) {
      await this.#deleteSecrets(value);
    }
    this.#keyValueData.delete(key);
    this.#dirty = true;
  }

  async #deleteSecrets(value: ValueNode): Promise<void> {
    if (typeof value === "string" && value.startsWith(SECRET_SENTINEL_PREFIX)) {
      if (this.#secretService) {
        const bunSecretName = value.slice(SECRET_SENTINEL_PREFIX.length);
        await this.#secretService.deleteSecret(bunSecretName);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        await this.#deleteSecrets(item);
      }
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const propertyValue of Object.values(value)) {
        await this.#deleteSecrets(propertyValue as ValueNode);
      }
    }
  }
}
