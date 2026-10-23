import { isDeepStrictEqual } from "node:util";
import { parse, patch, stringify } from "@decimalturn/toml-patch";
import type ConfigFormat from "./ConfigFormat.ts";
import type { ConfigData } from "./ConfigFormat.ts";

// new tables nested deeper than this (e.g. `defaults.<command>.<option>`) are left to patch() to
// lay out as inline tables
const MAX_TABLE_HEADER_DEPTH = 3;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function collectNewTables(
  existing: unknown,
  updated: Record<string, unknown>,
  path: Array<string>,
  newTables: Array<Array<string>>,
): void {
  for (const [key, value] of Object.entries(updated)) {
    if (!isPlainObject(value) || path.length + 1 > MAX_TABLE_HEADER_DEPTH) {
      continue;
    }
    const childPath = [...path, key];
    const existingChild = isPlainObject(existing) ? existing[key] : undefined;
    if (existingChild === undefined) {
      newTables.push(childPath);
    }
    collectNewTables(existingChild, value, childPath, newTables);
  }
}

// parse() results do not share prototypes with plain objects
function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Append an empty `[table]` header for every new table, so that patch() fills it in at the end
 * of the file rather than hoisting it to the top as a dotted key. Returns the original text if the
 * result is not equivalent to it plus the empty tables (e.g. the parent is an inline table which
 * cannot be extended).
 */
function addNewTableHeaders(text: string, existing: ConfigData, changes: ConfigData): string {
  const newTables: Array<Array<string>> = [];
  collectNewTables(existing, changes, [], newTables);
  if (newTables.length === 0) {
    return text;
  }
  const expected = structuredClone(existing);
  for (const tablePath of newTables) {
    let node = expected;
    for (const key of tablePath.slice(0, -1)) {
      node = (node[key] ??= {}) as ConfigData;
    }
    node[tablePath[tablePath.length - 1]!] ??= {};
  }
  const headers = newTables.map((tablePath) => `[${tablePath.map(formatKey).join(".")}]`);
  const withHeaders = `${text.trimEnd()}\n\n${headers.join("\n\n")}\n`;
  try {
    return isDeepStrictEqual(plain(parse(withHeaders)), plain(expected)) ? withHeaders : text;
  } catch {
    return text;
  }
}

/**
 * A TOML {@link ConfigFormat} which preserves comments, whitespace and layout when writing changes back.
 * Dates and times are not supported as configuration values.
 *
 * Requires the optional `@decimalturn/toml-patch` peer dependency.
 */
const tomlFormat: ConfigFormat = {
  fileExtension: "toml",
  parse(text: string) {
    return { data: parse(text) as ConfigData, handle: text };
  },
  apply(handle: unknown, changes: ConfigData): string {
    const text = handle as string;
    const existing = parse(text) as ConfigData;
    return patch(addNewTableHeaders(text, existing, changes), changes);
  },
  serialize(data: ConfigData): string {
    return stringify(data);
  },
};

export default tomlFormat;
