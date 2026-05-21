/**
 * Internal service providing secret storage via OS-native credential stores.
 * Not registered in Context -- used internally by {@link DefaultKeyValueService}.
 */
export default interface SecretService {
  /**
   * Store a secret value. Constructs the Bun secret name from the current scope and key.
   *
   * @returns the constructed Bun secret name (used as part of the sentinel value in the key-value Map).
   */
  setSecret(key: string, value: string): Promise<string>;

  /**
   * Retrieve a secret value by its full Bun secret name.
   */
  getSecret(bunSecretName: string): Promise<string | null>;

  /**
   * Delete a secret by its full Bun secret name.
   */
  deleteSecret(bunSecretName: string): Promise<boolean>;

  /**
   * Check if a secret exists by its full Bun secret name.
   */
  hasSecret(bunSecretName: string): Promise<boolean>;
}
