/**
 * Splits a plugin specifier into a bare plugin ID and an optional version, following npm's own
 * `[@scope/]name[@version]` convention (`:` is not used as a version separator anywhere in the
 * npm/JS ecosystem, so it is not supported here).
 *
 * A leading `@scope/` portion (if present) is stripped first, then the *last* `@` in the
 * remainder - if any - is the version separator. This correctly distinguishes the scope marker
 * (always the first character) from a version-separating `@` occurring later.
 *
 * Everything after the separator is always treated as the requested version, including
 * non-semver tags such as `latest` or `next` - no validation is performed on the tail.
 *
 * @param specifier raw plugin specifier, e.g. `@scope/name`, `@scope/name@3.0.0` or
 *   `name@latest`.
 */
export function parsePluginSpecifier(specifier: string): { pluginId: string; version?: string } {
  const isScoped = specifier.startsWith("@");
  const scopeEnd = isScoped ? specifier.indexOf("/") : -1;
  const searchFrom = isScoped && scopeEnd !== -1 ? scopeEnd + 1 : 0;
  const atIndex = specifier.lastIndexOf("@");
  if (atIndex === -1 || atIndex < searchFrom) {
    return { pluginId: specifier };
  }
  return {
    pluginId: specifier.slice(0, atIndex),
    version: specifier.slice(atIndex + 1),
  };
}
