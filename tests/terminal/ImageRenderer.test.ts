import { deflateSync } from "node:zlib";
import { describe, expect, test } from "bun:test";
import ImageRenderer from "../../src/terminal/ImageRenderer.ts";
import type Terminal from "../../src/terminal/Terminal.ts";

// Build a proper PNG with valid CRC values
function crc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  return table;
}

const CRC_TABLE = crc32Table();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildValidPng(
  width: number,
  height: number,
  colorType: number = 6,
): Uint8Array {
  const parts: number[] = [];

  // PNG signature
  parts.push(137, 80, 78, 71, 13, 10, 26, 10);

  function addChunk(type: string, data: Uint8Array) {
    // Length (4 bytes big-endian)
    const len = data.length;
    parts.push(
      (len >>> 24) & 0xff,
      (len >>> 16) & 0xff,
      (len >>> 8) & 0xff,
      len & 0xff,
    );

    // Type (4 bytes)
    const typeBytes = new TextEncoder().encode(type);
    for (const b of typeBytes) parts.push(b);

    // Data
    for (const b of data) parts.push(b);

    // CRC over type + data
    const crcInput = new Uint8Array(4 + data.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(data, 4);
    const crcVal = crc32(crcInput);
    parts.push(
      (crcVal >>> 24) & 0xff,
      (crcVal >>> 16) & 0xff,
      (crcVal >>> 8) & 0xff,
      crcVal & 0xff,
    );
  }

  // IHDR
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  addChunk("IHDR", ihdr);

  // IDAT
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = new Uint8Array(height * (1 + stride));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      raw[offset++] = (x * 80 + y * 40) & 0xff; // R
      raw[offset++] = (x * 60 + y * 30) & 0xff; // G
      raw[offset++] = (x * 40 + y * 20) & 0xff; // B
      if (bpp === 4) {
        raw[offset++] = 255; // A
      }
    }
  }
  const compressed = deflateSync(raw);
  addChunk("IDAT", new Uint8Array(compressed));

  // IEND
  addChunk("IEND", new Uint8Array(0));

  return new Uint8Array(parts);
}

function createMockTerminal(columns: number = 80, rows: number = 24): Terminal {
  return {
    clearLine: () => Promise.resolve(),
    clearUpLines: () => Promise.resolve(),
    hideCursor: () => Promise.resolve(),
    showCursor: () => Promise.resolve(),
    write: () => Promise.resolve(),
    columns: () => columns,
    rows: () => rows,
  };
}

describe("ImageRenderer", () => {
  test("renderImage returns ANSI block string in non-graphical terminal", async () => {
    const terminal = createMockTerminal(40, 20);
    const renderer = new ImageRenderer(terminal);
    const png = buildValidPng(4, 4, 6);

    const result = await renderer.renderImage(png, 50);
    expect(typeof result).toBe("string");
    // ANSI blocks output should contain newlines (one per pair of rows)
    expect(result).toContain("\n");
  });

  test("renderImage with default widthPercentage", async () => {
    const terminal = createMockTerminal(80, 24);
    const renderer = new ImageRenderer(terminal);
    const png = buildValidPng(2, 2, 6);

    const result = await renderer.renderImage(png);
    expect(typeof result).toBe("string");
  });

  test("renderImage with RGB image (colorType=2)", async () => {
    const terminal = createMockTerminal(40, 20);
    const renderer = new ImageRenderer(terminal);
    const png = buildValidPng(4, 4, 2);

    const result = await renderer.renderImage(png, 50);
    expect(typeof result).toBe("string");
  });
});
