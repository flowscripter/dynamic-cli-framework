import { assert, assertEquals, assertFalse } from "@std/assert";
import type { Buffer } from "@std/streams";
import * as colors from "@std/fmt/colors";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export function expectBufferStringIncludes(actual: Buffer, expected: string) {
  assert(decoder.decode(actual.bytes()).includes(expected));
}

export function expectBufferStringNotIncludes(
  actual: Buffer,
  expected: string,
) {
  assertFalse(decoder.decode(actual.bytes()).includes(expected));
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function expectBufferStringEquals(actual: Buffer, expected: string) {
  assertEquals(colors.stripAnsiCode(decoder.decode(actual.bytes())), expected);
}

export function expectBufferBytesEquals(actual: Buffer, expected: Uint8Array) {
  assertEquals(actual.bytes(), expected);
}

export async function write(
  writableStream: WritableStream,
  message: string,
) {
  const encoded = encoder.encode(message);
  const writer = writableStream.getWriter();

  await writer.ready;
  await writer.write(encoded);

  writer.releaseLock();
}
