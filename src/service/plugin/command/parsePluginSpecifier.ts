/**
 * Splits a plugin specifier into a bare plugin ID and an optional version.
 *
 * The specifier is split on the *last* `:` character, if present. Scoped npm package names
 * (e.g. `@scope/name`) never legitimately contain a literal `:`, so this split cannot collide
 * with the scope/slash structure of the plugin ID itself.
 *
 * Everything after the last `:` is always treated as the requested version, including
 * non-semver tags such as `latest` or `next` - no validation is performed on the tail.
 *
 * @param specifier raw plugin specifier, e.g. `@scope/name`, `@scope/name:3.0.0` or `name:latest`.
 */
export function parsePluginSpecifier(specifier: string): { pluginId: string; version?: string } {
  const index = specifier.lastIndexOf(":");
  if (index === -1) {
    return { pluginId: specifier };
  }
  return {
    pluginId: specifier.slice(0, index),
    version: specifier.slice(index + 1),
  };
}
