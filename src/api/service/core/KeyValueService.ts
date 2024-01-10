export const KEY_VALUE_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/key-value-service";

/**
 * Service providing keystore functionality for the CLI. The keystore data is scoped to the
 * service or {@link Command} instances accessing this service via {@link Context.getServiceById}
 */
export default interface KeyValueService {
  /**
   * Get a value for a specified key in the keystore.
   */
  getKey(key: string): string;

  /**
   * Set a value for a specified key in the keystore.
   */
  setKey(key: string, value: string): void;

  /**
   * Check if a value for a specified key exists in the keystore.
   */
  hasKey(key: string): boolean;

  /**
   * Delete the value for a specified key in the keystore.
   */
  deleteKey(key: string): void;
}
