import { Document, isMap, isSeq, parseDocument, stringify } from "yaml";
import type ConfigFormat from "./ConfigFormat.ts";
import type { ConfigData } from "./ConfigFormat.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reconcile(
  doc: Document,
  path: Array<string | number>,
  existing: unknown,
  updated: unknown,
): void {
  if (isPlainObject(existing) && isPlainObject(updated)) {
    for (const key of Object.keys(existing)) {
      if (!(key in updated)) {
        doc.deleteIn([...path, key]);
      }
    }
    for (const key of Object.keys(updated)) {
      if (key in existing) {
        reconcile(doc, [...path, key], existing[key], updated[key]);
      } else {
        doc.setIn([...path, key], updated[key]);
      }
    }
  } else if (
    Array.isArray(existing) &&
    Array.isArray(updated) &&
    existing.length === updated.length
  ) {
    updated.forEach((value, index) => reconcile(doc, [...path, index], existing[index], value));
  } else if (JSON.stringify(existing) !== JSON.stringify(updated)) {
    doc.setIn(path, updated);
  }
}

/**
 * A YAML {@link ConfigFormat} which preserves comments, blank lines and key order when writing changes back.
 *
 * Requires the optional `yaml` peer dependency.
 */
const yamlFormat: ConfigFormat = {
  fileExtension: "yaml",
  parse(text: string) {
    const doc = parseDocument(text);
    if (doc.errors.length > 0) {
      throw new Error(doc.errors.map((error) => error.message).join("; "));
    }
    const data = doc.toJS() ?? {};
    if (!isPlainObject(data)) {
      throw new Error("top level YAML value must be a mapping");
    }
    return { data, handle: doc };
  },
  apply(handle: unknown, changes: ConfigData): string {
    const doc = handle as Document;
    const existing = doc.toJS() ?? {};
    if (!isMap(doc.contents) && !isSeq(doc.contents)) {
      doc.contents = doc.createNode(changes);
    } else {
      reconcile(doc, [], existing, changes);
    }
    return doc.toString();
  },
  serialize(data: ConfigData): string {
    return stringify(data);
  },
};

export default yamlFormat;
