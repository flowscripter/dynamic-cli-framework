import type { VersionedPluginDescriptor } from "@flowscripter/dynamic-plugin-framework";

export function getPluginId(descriptor: VersionedPluginDescriptor): string {
  return descriptor.scope ? `@${descriptor.scope}/${descriptor.name}` : descriptor.name;
}
