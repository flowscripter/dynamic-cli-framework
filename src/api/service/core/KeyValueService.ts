export const KEY_VALUE_SERVICE_ID = "@flowscripter/dynamic-cli-framework/key-value-service";

/**
 * The sentinel prefix used to indicate a value is stored as an OS-native secret.
 * Values starting with this prefix are resolved via the {@link SecretService}.
 * This prefix is reserved and must not be used for regular key-value data.
 */
export const SECRET_SENTINEL_PREFIX = "__SECRET__:";

/**
 * Service providing keystore functionality for the CLI. The keystore data is scoped to the
 * service or {@link Command} instances accessing this service via {@link Context.getServiceById}.
 *
 * Values can optionally be stored as OS-native secrets using the `isSecret` parameter on
 * {@link setKey}. Secret values are stored via {@link SecretService} and only a sentinel
 * reference is kept in the key-value Map. The sentinel prefix `__SECRET__:` is reserved.
 */
export default interface KeyValueService {
  /**
   * Get a value for a specified key in the keystore.
   * If the stored value is a secret sentinel, the actual value is retrieved from the OS secret store.
   */
  getKey(key: string): Promise<string>;

  /**
   * Set a value for a specified key in the keystore.
   *
   * @param isSecret if true, the value is stored in the OS-native secret store and a sentinel
   *   reference is kept in the key-value Map. Requires that the service was constructed with
   *   secret support enabled.
   */
  setKey(key: string, value: string, isSecret?: boolean): Promise<void>;

  /**
   * Check if a value for a specified key exists in the keystore.
   */
  hasKey(key: string): Promise<boolean>;

  /**
   * Delete the value for a specified key in the keystore.
   * If the stored value is a secret sentinel, the secret is also deleted from the OS secret store.
   */
  deleteKey(key: string): Promise<void>;
}
