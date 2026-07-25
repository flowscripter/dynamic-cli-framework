import type { KeyValueData, KeyValueService } from "@flowscripter/dynamic-cli-framework-api";
import { SECRET_SENTINEL_PREFIX } from "@flowscripter/dynamic-cli-framework-api";
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

    const resolveSecret = async (bunSecretName: string): Promise<string> => {
      if (!this.#secretService) {
        throw new Error("Secret sentinel found but no secret service is available");
      }
      const secretValue = await this.#secretService.getSecret(bunSecretName);
      if (secretValue === null) {
        throw new Error(`Secret not found in OS secret store for key: '${key}'`);
      }
      return secretValue;
    };

    let resolvedValue: KeyValueData = value;
    if (typeof value === "string" && value.startsWith(SECRET_SENTINEL_PREFIX)) {
      const bunSecretName = value.slice(SECRET_SENTINEL_PREFIX.length);
      const secretValue = await resolveSecret(bunSecretName);
      resolvedValue = JSON.parse(secretValue) as KeyValueData;
    }

    return (await resolveSecrets(resolvedValue, resolveSecret)) as T;
  }

  public has(key: string): Promise<boolean> {
    if (this.#keyValueData === undefined) {
      return Promise.reject(new Error("Attempt to access undefined key-value data"));
    }
    return Promise.resolve(this.#keyValueData.has(key));
  }

  public async set(key: string, value: KeyValueData, isSecret = false): Promise<void> {
    if (this.#keyValueData === undefined) {
      throw new Error("Attempt to access undefined key-value data");
    }
    if (isSecret) {
      if (!this.#secretService) {
        throw new Error("Attempt to set a secret but no secret service is available");
      }
      const bunSecretName = await this.#secretService.setSecret(key, JSON.stringify(value));
      this.#keyValueData.set(key, SECRET_SENTINEL_PREFIX + bunSecretName);
    } else {
      this.#keyValueData.set(key, value);
    }
    this.#dirty = true;
  }

  public async delete(key: string): Promise<void> {
    if (this.#keyValueData === undefined) {
      throw new Error("Attempt to access undefined key-value data");
    }
    const value = this.#keyValueData.get(key);
    if (typeof value === "string" && value.startsWith(SECRET_SENTINEL_PREFIX)) {
      if (this.#secretService) {
        const bunSecretName = value.slice(SECRET_SENTINEL_PREFIX.length);
        await this.#secretService.deleteSecret(bunSecretName);
      }
    }
    this.#keyValueData.delete(key);
    this.#dirty = true;
  }
}
