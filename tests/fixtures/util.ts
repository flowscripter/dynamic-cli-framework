import { expect } from "bun:test";
import { stripVTControlCharacters } from "node:util";
import { WritableStream } from "node:stream/web";

const encoder = new TextEncoder();

export function expectStringIncludes(actual: string, expected: string) {
  expect(stripVTControlCharacters(actual).includes(expected)).toBeTrue();
}

export function expectStringNotIncludes(
  actual: string,
  expected: string,
) {
  expect(stripVTControlCharacters(actual).includes(expected)).toBeFalse();
}

export function expectStringEquals(actual: string, expected: string) {
  expect(stripVTControlCharacters(actual)).toEqual(expected);
}

export function expectBytesEquals(actual: string, expected: Uint8Array) {
  expect(encoder.encode(actual)).toEqual(expected);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
