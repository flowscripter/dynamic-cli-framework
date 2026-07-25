import type {
  KeyValueData,
  KeyValueService,
  SettableKeyValueData,
} from "@flowscripter/dynamic-cli-framework-api";
import { Secret, SECRET_SENTINEL_PREFIX } from "@flowscripter/dynamic-cli-framework-api";
import type DefaultSecretService from "./DefaultSecretService.ts";
import resolveSecrets from "./resolveSecrets.ts";

export default class DefaultKeyValueService implements KeyValueService {
  #keyValueData: Map<string, KeyValueData> | undefined;
  #dirty = false;
  readonly #secretService: DefaultSecretService | undefined;

  constructor(secretService?: DefaultSecretService) {
    this.#secretService = secretService;
  }

  public setKeyValueData(keyValueData: Map<string, KeyValueData>) {
    if (this.#keyValueData) {
      throw new Error("Attempt to overwrite key-value data, it should be cleared first");
    }
    this.#keyValueData = keyValueData;
    this.#dirty = false;
  }

  public clearKeyValueData() {
    this.#keyValueData = undefined;
    this.#dirty = false;
  }

  public isDirty(): boolean {
    return this.#dirty;
  }

  public async get<T extends KeyValueData = KeyValueData>(key: string): Promise<T> {
    if (this.#keyValueData === undefined) {
      throw new Error("Attempt to access undefined key-value data");
    }
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
    if (this.#keyValueData === undefined) {
      return Promise.reject(new Error("Attempt to access undefined key-value data"));
    }
    return Promise.resolve(this.#keyValueData.has(key));
  }

  public async set(key: string, value: SettableKeyValueData): Promise<void> {
    if (this.#keyValueData === undefined) {
      throw new Error("Attempt to access undefined key-value data");
    }
    this.#keyValueData.set(key, await this.#storeSecrets(key, value, []));
    this.#dirty = true;
  }

  async #storeSecrets(
    key: string,
    value: SettableKeyValueData,
    path: Array<string>,
  ): Promise<KeyValueData> {
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
      const result: Array<KeyValueData> = [];
      for (let i = 0; i < value.length; i += 1) {
        result.push(await this.#storeSecrets(key, value[i]!, [...path, String(i)]));
      }
      return result as KeyValueData;
    }
    if (typeof value === "object" && value !== null) {
      const result: Record<string, KeyValueData> = {};
      for (const [propertyName, propertyValue] of Object.entries(value)) {
        result[propertyName] = await this.#storeSecrets(key, propertyValue, [
          ...path,
          propertyName,
        ]);
      }
      return result as KeyValueData;
    }
    return value;
  }

  public async delete(key: string): Promise<void> {
    if (this.#keyValueData === undefined) {
      throw new Error("Attempt to access undefined key-value data");
    }
    const value = this.#keyValueData.get(key);
    if (value !== undefined) {
      await this.#deleteSecrets(value);
    }
    this.#keyValueData.delete(key);
    this.#dirty = true;
  }

  async #deleteSecrets(value: KeyValueData): Promise<void> {
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
        await this.#deleteSecrets(propertyValue as KeyValueData);
      }
    }
  }
}
