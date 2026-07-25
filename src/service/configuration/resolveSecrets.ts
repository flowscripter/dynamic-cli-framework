import { SECRET_SENTINEL_PREFIX } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Recursively walk the provided value and resolve any string leaf - at any depth - which starts
 * with {@link SECRET_SENTINEL_PREFIX}, via the provided resolver callback.
 *
 * @param value the value to walk (a JSON-serializable value or a `PopulatedArgumentValues` /
 *   `PopulatedArgumentValueType` tree).
 * @param resolveSecret callback used to resolve a sentinel-prefixed string (with the prefix
 *   stripped) to its actual value. Should throw if the secret cannot be found.
 */
export default async function resolveSecrets<T>(
  value: T,
  resolveSecret: (sentinelValue: string) => Promise<string>,
): Promise<T> {
  if (typeof value === "string" && value.startsWith(SECRET_SENTINEL_PREFIX)) {
    const bunSecretName = value.slice(SECRET_SENTINEL_PREFIX.length);
    return (await resolveSecret(bunSecretName)) as unknown as T;
  }
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      const resolved = [];
      for (const item of value) {
        resolved.push(await resolveSecrets(item, resolveSecret));
      }
      return resolved as unknown as T;
    }
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = await resolveSecrets(val, resolveSecret);
    }
    return resolved as unknown as T;
  }
  return value;
}
