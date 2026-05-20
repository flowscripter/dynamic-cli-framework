// Minimal PNG-to-RGBA pixel extractor. Supports 8-bit RGB and RGBA only.
import { inflateSync } from "node:zlib";

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePngToRGBA(
  pngBytes: Uint8Array,
): { width: number; height: number; pixels: Uint8Array } {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (pngBytes[i] !== sig[i]) throw new Error("Invalid PNG signature");
  }

  const view = new DataView(
    pngBytes.buffer,
    pngBytes.byteOffset,
    pngBytes.byteLength,
  );
  let offset = 8;

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset < pngBytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      pngBytes[offset + 4]!,
      pngBytes[offset + 5]!,
      pngBytes[offset + 6]!,
      pngBytes[offset + 7]!,
    );
    const dataStart = offset + 8;

    if (type === "IHDR") {
      width = view.getUint32(dataStart);
      height = view.getUint32(dataStart + 4);
      bitDepth = pngBytes[dataStart + 8]!;
      colorType = pngBytes[dataStart + 9]!;
      const interlace = pngBytes[dataStart + 12]!;
      if (bitDepth !== 8) {
        throw new Error(
          `Unsupported bit depth: ${bitDepth} (only 8 supported)`,
        );
      }
      if (colorType !== 2 && colorType !== 6) {
        throw new Error(
          `Unsupported color type: ${colorType} (only RGB=2 and RGBA=6 supported)`,
        );
      }
      if (interlace !== 0) {
        throw new Error("Interlaced PNGs are not supported");
      }
    } else if (type === "IDAT") {
      idatChunks.push(pngBytes.subarray(dataStart, dataStart + length));
    } else if (type === "IEND") {
      break;
    }

    offset = dataStart + length + 4; // +4 for CRC
  }

  if (width === 0 || height === 0) throw new Error("Missing IHDR chunk");
  if (idatChunks.length === 0) throw new Error("Missing IDAT chunks");

  const bpp = colorType === 6 ? 4 : 3;
  const compressed = new Uint8Array(
    idatChunks.reduce((sum, c) => sum + c.length, 0),
  );
  let pos = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, pos);
    pos += chunk.length;
  }

  const raw = inflateSync(compressed);
  const stride = bpp * width;
  const pixels = new Uint8Array(width * height * 4);
  const prevRow = new Uint8Array(stride);
  const currRow = new Uint8Array(stride);

  let rawOffset = 0;

  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset++]!;

    for (let x = 0; x < stride; x++) {
      currRow[x] = raw[rawOffset++]!;
    }

    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? currRow[x - bpp]! : 0;
      const up = prevRow[x]!;
      const upperLeft = x >= bpp ? prevRow[x - bpp]! : 0;

      switch (filterType) {
        case 0:
          break;
        case 1:
          currRow[x] = (currRow[x]! + left) & 0xff;
          break;
        case 2:
          currRow[x] = (currRow[x]! + up) & 0xff;
          break;
        case 3:
          currRow[x] = (currRow[x]! + ((left + up) >> 1)) & 0xff;
          break;
        case 4:
          currRow[x] = (currRow[x]! + paethPredictor(left, up, upperLeft)) &
            0xff;
          break;
        default:
          throw new Error(`Unknown filter type: ${filterType}`);
      }
    }

    const rowStart = y * width * 4;
    if (bpp === 4) {
      pixels.set(currRow, rowStart);
    } else {
      for (let x = 0; x < width; x++) {
        pixels[rowStart + x * 4] = currRow[x * 3]!;
        pixels[rowStart + x * 4 + 1] = currRow[x * 3 + 1]!;
        pixels[rowStart + x * 4 + 2] = currRow[x * 3 + 2]!;
        pixels[rowStart + x * 4 + 3] = 255;
      }
    }

    prevRow.set(currRow);
  }

  return { width, height, pixels };
}
