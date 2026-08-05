/**
 * Splits a plugin specifier into a bare plugin ID and an optional version.
 *
 * Two version separators are supported:
 * - `:` (this tool's original convention), e.g. `@scope/name:3.0.0`.
 * - `@` (the npm/bun convention), e.g. `@scope/name@3.0.0`.
 *
 * The specifier is first checked for a `:` separator, split on the *last* `:` character if
 * present. Scoped npm package names (e.g. `@scope/name`) never legitimately contain a literal
 * `:`, so this split cannot collide with the scope/slash structure of the plugin ID itself. If
 * both `:` and `@` version separators are present (e.g. `pkg:1.0.0@2.0.0`), `:` takes precedence
 * - this preserves existing behaviour for users of the original `:` syntax unchanged.
 *
 * Otherwise, an `@`-based version is looked for, mirroring npm's own `[@scope/]name[@version]`
 * convention: a leading `@scope/` portion (if present) is stripped first, then the *last* `@` in
 * the remainder - if any - is the version separator. This correctly distinguishes the scope
 * marker (always the first character) from a version-separating `@` occurring later.
 *
 * Everything after the separator is always treated as the requested version, including
 * non-semver tags such as `latest` or `next` - no validation is performed on the tail.
 *
 * @param specifier raw plugin specifier, e.g. `@scope/name`, `@scope/name:3.0.0`,
 *   `@scope/name@3.0.0` or `name:latest`.
 */
export function parsePluginSpecifier(specifier: string): { pluginId: string; version?: string } {
  const colonIndex = specifier.lastIndexOf(":");
  if (colonIndex !== -1) {
    return {
      pluginId: specifier.slice(0, colonIndex),
      version: specifier.slice(colonIndex + 1),
    };
  }

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
