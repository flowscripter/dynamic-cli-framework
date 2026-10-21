import type ConfigFormat from "./ConfigFormat.ts";
import type { ConfigData } from "./ConfigFormat.ts";

function serialize(data: ConfigData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * The built-in JSON {@link ConfigFormat}. The file is regenerated on write: JSON has no comments to preserve.
 */
const jsonFormat: ConfigFormat = {
  fileExtension: "json",
  parse(text: string) {
    return { data: JSON.parse(text) as ConfigData, handle: undefined };
  },
  apply(_handle: unknown, changes: ConfigData): string {
    return serialize(changes);
  },
  serialize,
};

export default jsonFormat;
