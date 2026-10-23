import type { SecretService } from "@flowscripter/dynamic-cli-framework-api";
import { secrets as bunSecrets } from "bun";

const MAX_NAME_LENGTH = 255;
const MAX_VALUE_BYTES = 2047;

export interface SecretsApi {
  get(options: { service: string; name: string }): Promise<string | null>;
  set(options: { service: string; name: string; value: string }): Promise<void>;
  delete(options: { service: string; name: string }): Promise<boolean>;
}

export default class DefaultSecretService implements SecretService {
  readonly #serviceName: string;
  readonly #secrets: SecretsApi;
  readonly #scope: string;

  constructor(serviceName: string, scope: string, secretsApi?: SecretsApi) {
    this.#serviceName = DefaultSecretService.#sanitize(serviceName);
    if (this.#serviceName.length > MAX_NAME_LENGTH) {
      throw new Error(
        `Service name exceeds ${MAX_NAME_LENGTH} characters after sanitization: '${this.#serviceName}'`,
      );
    }
    this.#scope = DefaultSecretService.#sanitize(scope);
    this.#secrets = secretsApi ?? bunSecrets;
  }

  static #sanitize(value: string): string {
    return value.replace(/[^a-zA-Z0-9_]/g, "_");
  }

  /**
   * The name under which a secret with the provided key is stored.
   */
  public secretName(key: string): string {
    return this.#scope + "_" + DefaultSecretService.#sanitize(key);
  }

  /**
   * Whether the stored secret name was created by this scope.
   */
  public ownsSecretName(bunSecretName: string): boolean {
    return bunSecretName.startsWith(this.#scope + "_");
  }

  public async setSecret(key: string, value: string): Promise<string> {
    const name = this.secretName(key);
    if (name.length > MAX_NAME_LENGTH) {
      throw new Error(`Secret name exceeds ${MAX_NAME_LENGTH} characters: '${name}'`);
    }
    if (new TextEncoder().encode(value).byteLength > MAX_VALUE_BYTES) {
      throw new Error(`Secret value exceeds ${MAX_VALUE_BYTES} bytes`);
    }
    await this.#secrets.set({
      service: this.#serviceName,
      name,
      value,
    });
    return name;
  }

  public async getSecret(bunSecretName: string): Promise<string | null> {
    return await this.#secrets.get({
      service: this.#serviceName,
      name: bunSecretName,
    });
  }

  public async deleteSecret(bunSecretName: string): Promise<boolean> {
    return await this.#secrets.delete({
      service: this.#serviceName,
      name: bunSecretName,
    });
  }

  public async hasSecret(bunSecretName: string): Promise<boolean> {
    return (
      (await this.#secrets.get({
        service: this.#serviceName,
        name: bunSecretName,
      })) !== null
    );
  }
}
