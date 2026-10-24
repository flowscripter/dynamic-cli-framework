import type { SecretService } from "@flowscripter/dynamic-cli-framework-api";
import { secrets as bunSecrets } from "bun";

const MAX_NAME_LENGTH = 255;
const MAX_VALUE_BYTES = 2047;

export interface SecretsApi {
  get(options: { service: string; name: string }): Promise<string | null>;
  set(options: { service: string; name: string; value: string }): Promise<void>;
  delete(options: { service: string; name: string }): Promise<boolean>;
}

/**
 * Injective escape of a name component to [A-Za-z0-9_]: alphanumerics are kept and every other
 * character (including `_`) becomes `_<UPPERCASE HEX CODE POINT>_`.
 */
function escapeComponent(value: string): string {
  let result = "";
  for (const char of value) {
    result += /[a-zA-Z0-9]/.test(char)
      ? char
      : `_${char.codePointAt(0)!.toString(16).toUpperCase()}_`;
  }
  return result;
}

// `Z` is not a hex digit so `_Z` can never be mistaken for the start of an escape.
const SEPARATOR = "_Z";

export default class DefaultSecretService implements SecretService {
  readonly #serviceName: string;
  readonly #secrets: SecretsApi;
  readonly #scope: ReadonlyArray<string>;

  /**
   * @param scope the components identifying the scope, e.g. `["command", "a"]`.
   */
  constructor(serviceName: string, scope: ReadonlyArray<string>, secretsApi?: SecretsApi) {
    this.#serviceName = serviceName.replace(/[^a-zA-Z0-9_]/g, "_");
    if (this.#serviceName.length > MAX_NAME_LENGTH) {
      throw new Error(
        `Service name exceeds ${MAX_NAME_LENGTH} characters after sanitization: '${this.#serviceName}'`,
      );
    }
    this.#scope = scope;
    this.#secrets = secretsApi ?? bunSecrets;
  }

  #scopePrefix(): string {
    return this.#scope.map((c) => escapeComponent(c) + SEPARATOR).join("");
  }

  /**
   * The name under which a secret with the provided key is stored. The scope and key components
   * are escaped and delimited so that distinct (scope, key) pairs never produce the same name.
   *
   * @param key a single key or the components of a key, e.g. a key and a path within its value.
   */
  public secretName(key: string | ReadonlyArray<string>): string {
    const parts = typeof key === "string" ? [key] : key;
    return this.#scopePrefix() + parts.map(escapeComponent).join(SEPARATOR);
  }

  /**
   * Whether the stored secret name was created by this scope, and, if `firstKeyComponent` is
   * provided, with that value as the first component of its key.
   */
  public ownsSecretName(bunSecretName: string, firstKeyComponent?: string): boolean {
    if (firstKeyComponent === undefined) {
      return bunSecretName.startsWith(this.#scopePrefix());
    }
    const base = this.#scopePrefix() + escapeComponent(firstKeyComponent);
    return bunSecretName === base || bunSecretName.startsWith(base + SEPARATOR);
  }

  public async setSecret(key: string | ReadonlyArray<string>, value: string): Promise<string> {
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
