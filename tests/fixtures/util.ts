import {
  assert,
  assertEquals,
  assertFalse,
  Buffer,
  colors,
  conversions,
} from "../test_deps.ts";

export function expectBufferStringIncludes(actual: Buffer, expected: string) {
  const decoder = new TextDecoder();
  assert(decoder.decode(actual.bytes()).includes(expected));
}

export function expectBufferStringNotIncludes(
  actual: Buffer,
  expected: string,
) {
  const decoder = new TextDecoder();
  assertFalse(decoder.decode(actual.bytes()).includes(expected));
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function expectBufferStringEquals(actual: Buffer, expected: string) {
  const decoder = new TextDecoder();
  assertEquals(colors.stripColor(decoder.decode(actual.bytes())), expected);
}

export function expectBufferBytesEquals(actual: Buffer, expected: Uint8Array) {
  assertEquals(actual.bytes(), expected);
}

export async function write(writable: WritableStream, message: string) {
  const contentBytes = new TextEncoder().encode(message);
  await conversions.writeAll(
    conversions.writerFromStreamWriter(writable.getWriter()),
    contentBytes,
  );
}
