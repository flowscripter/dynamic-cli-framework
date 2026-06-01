import { deflateSync } from "node:zlib";
import { describe, expect, test } from "bun:test";
import { decodePngToRGBA } from "../../src/terminal/PngDecoder.ts";

// Helper to build a minimal PNG from raw components
function buildPng(
  chunks: Array<{ type: string; data: Uint8Array }>,
): Uint8Array {
  const parts: Uint8Array[] = [];
  // PNG signature
  parts.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

  for (const chunk of chunks) {
    const typeBytes = new TextEncoder().encode(chunk.type);
    const lengthBuf = new ArrayBuffer(4);
    new DataView(lengthBuf).setUint32(0, chunk.data.length);

    // CRC placeholder (4 bytes of zeros - decoder doesn't validate CRC)
    const crc = new Uint8Array(4);

    parts.push(new Uint8Array(lengthBuf));
    parts.push(typeBytes);
    parts.push(chunk.data);
    parts.push(crc);
  }

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

function makeIHDR(
  width: number,
  height: number,
  bitDepth: number,
  colorType: number,
  interlace: number = 0,
): Uint8Array {
  const buf = new ArrayBuffer(13);
  const view = new DataView(buf);
  view.setUint32(0, width);
  view.setUint32(4, height);
  const bytes = new Uint8Array(buf);
  bytes[8] = bitDepth;
  bytes[9] = colorType;
  bytes[10] = 0; // compression
  bytes[11] = 0; // filter method
  bytes[12] = interlace;
  return bytes;
}

// Build raw scanline data for a simple image with a given filter type
function makeRawScanlines(
  width: number,
  height: number,
  bpp: number,
  filterType: number,
): Uint8Array {
  const stride = width * bpp;
  const raw = new Uint8Array(height * (1 + stride));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = filterType;
    for (let x = 0; x < stride; x++) {
      // Simple pixel values
      raw[offset++] = ((y * stride + x) * 37 + 100) & 0xff;
    }
  }
  return raw;
}

function buildSimplePng(
  width: number,
  height: number,
  colorType: number,
  filterType: number = 0,
): Uint8Array {
  const bpp = colorType === 6 ? 4 : 3;
  const rawData = makeRawScanlines(width, height, bpp, filterType);
  const compressed = deflateSync(rawData);

  return buildPng([
    { type: "IHDR", data: makeIHDR(width, height, 8, colorType) },
    { type: "IDAT", data: new Uint8Array(compressed) },
    { type: "IEND", data: new Uint8Array(0) },
  ]);
}

describe("decodePngToRGBA", () => {
  test("decodes a simple RGBA (colorType=6) PNG", () => {
    const png = buildSimplePng(2, 2, 6, 0);
    const result = decodePngToRGBA(png);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.pixels.length).toBe(2 * 2 * 4);
  });

  test("decodes a simple RGB (colorType=2) PNG and sets alpha to 255", () => {
    const png = buildSimplePng(2, 2, 2, 0);
    const result = decodePngToRGBA(png);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.pixels.length).toBe(2 * 2 * 4);
    // Every 4th byte (alpha) should be 255
    for (let i = 3; i < result.pixels.length; i += 4) {
      expect(result.pixels[i]).toBe(255);
    }
  });

  test("handles filter type 1 (Sub)", () => {
    const png = buildSimplePng(3, 2, 6, 1);
    const result = decodePngToRGBA(png);
    expect(result.width).toBe(3);
    expect(result.height).toBe(2);
  });

  test("handles filter type 2 (Up)", () => {
    const png = buildSimplePng(3, 2, 6, 2);
    const result = decodePngToRGBA(png);
    expect(result.width).toBe(3);
    expect(result.height).toBe(2);
  });

  test("handles filter type 3 (Average)", () => {
    const png = buildSimplePng(3, 2, 6, 3);
    const result = decodePngToRGBA(png);
    expect(result.width).toBe(3);
    expect(result.height).toBe(2);
  });

  test("handles filter type 4 (Paeth)", () => {
    const png = buildSimplePng(3, 2, 6, 4);
    const result = decodePngToRGBA(png);
    expect(result.width).toBe(3);
    expect(result.height).toBe(2);
  });

  test("handles filter type 4 (Paeth) with RGB colorType", () => {
    const png = buildSimplePng(3, 3, 2, 4);
    const result = decodePngToRGBA(png);
    expect(result.width).toBe(3);
    expect(result.height).toBe(3);
    // Alpha should be 255 for RGB
    for (let i = 3; i < result.pixels.length; i += 4) {
      expect(result.pixels[i]).toBe(255);
    }
  });

  test("throws on invalid PNG signature", () => {
    const data = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(() => decodePngToRGBA(data)).toThrow("Invalid PNG signature");
  });

  test("throws on unsupported bit depth", () => {
    const png = buildPng([
      { type: "IHDR", data: makeIHDR(1, 1, 16, 2) },
      { type: "IEND", data: new Uint8Array(0) },
    ]);
    expect(() => decodePngToRGBA(png)).toThrow("Unsupported bit depth: 16");
  });

  test("throws on unsupported color type", () => {
    const png = buildPng([
      { type: "IHDR", data: makeIHDR(1, 1, 8, 0) },
      { type: "IEND", data: new Uint8Array(0) },
    ]);
    expect(() => decodePngToRGBA(png)).toThrow("Unsupported color type: 0");
  });

  test("throws on interlaced PNG", () => {
    const png = buildPng([
      { type: "IHDR", data: makeIHDR(1, 1, 8, 6, 1) },
      { type: "IEND", data: new Uint8Array(0) },
    ]);
    expect(() => decodePngToRGBA(png)).toThrow(
      "Interlaced PNGs are not supported",
    );
  });

  test("throws on unknown filter type", () => {
    // Build raw scanlines with invalid filter type 5
    const width = 1;
    const height = 1;
    const bpp = 4;
    const stride = width * bpp;
    const raw = new Uint8Array(height * (1 + stride));
    raw[0] = 5; // invalid filter
    for (let i = 1; i <= stride; i++) raw[i] = 128;
    const compressed = deflateSync(raw);

    const png = buildPng([
      { type: "IHDR", data: makeIHDR(width, height, 8, 6) },
      { type: "IDAT", data: new Uint8Array(compressed) },
      { type: "IEND", data: new Uint8Array(0) },
    ]);
    expect(() => decodePngToRGBA(png)).toThrow("Unknown filter type: 5");
  });

  test("handles multiple IDAT chunks", () => {
    const bpp = 4;
    const rawData = makeRawScanlines(2, 2, bpp, 0);
    const compressed = new Uint8Array(deflateSync(rawData));
    // Split compressed data into two chunks
    const mid = Math.floor(compressed.length / 2);
    const chunk1 = compressed.subarray(0, mid);
    const chunk2 = compressed.subarray(mid);

    const png = buildPng([
      { type: "IHDR", data: makeIHDR(2, 2, 8, 6) },
      { type: "IDAT", data: chunk1 },
      { type: "IDAT", data: chunk2 },
      { type: "IEND", data: new Uint8Array(0) },
    ]);
    const result = decodePngToRGBA(png);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });
});
