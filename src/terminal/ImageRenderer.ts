import supportsTerminalGraphics from "supports-terminal-graphics";
import { decodePngToRGBA } from "./PngDecoder.ts";
import {
  BACKGROUND_COLOR_END,
  backgroundColorStart,
  FOREGROUND_COLOR_END,
  foregroundColorStart,
} from "./Ansi.ts";
import type Terminal from "./Terminal.ts";
import { Buffer } from "node:buffer";

export default class ImageRenderer {
  #terminal: Terminal;

  constructor(terminal: Terminal) {
    this.#terminal = terminal;
  }

  renderImage(
    imageBuffer: Uint8Array,
    widthPercentage: number = 100,
  ): Promise<string> {
    if (supportsTerminalGraphics.stdout.kitty) {
      return this.#renderKitty(imageBuffer, widthPercentage);
    }
    if (supportsTerminalGraphics.stdout.iterm2) {
      return this.#renderITerm2(imageBuffer, widthPercentage);
    }
    return this.#renderAnsiBlocks(imageBuffer, widthPercentage);
  }

  // https://sw.kovidgoyal.net/kitty/graphics-protocol/
  async #renderKitty(
    imageBuffer: Uint8Array,
    widthPercentage: number,
  ): Promise<string> {
    const pngBytes = await new Bun.Image(imageBuffer).png().bytes();
    const columns = Math.floor(
      this.#terminal.columns() * widthPercentage / 100,
    );
    const base64 = Buffer.from(pngBytes).toString("base64");
    const chunks: string[] = [];
    for (let i = 0; i < base64.length; i += 4096) {
      chunks.push(base64.slice(i, i + 4096));
    }
    let result = "";
    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      if (i === 0) {
        result += `\x1b_Gf=100,a=T,c=${columns},m=${isLast ? 0 : 1};${
          chunks[i]
        }\x1b\\`;
      } else {
        result += `\x1b_Gm=${isLast ? 0 : 1};${chunks[i]}\x1b\\`;
      }
    }
    return result;
  }

  // https://iterm2.com/documentation-images.html
  async #renderITerm2(
    imageBuffer: Uint8Array,
    widthPercentage: number,
  ): Promise<string> {
    const pngBytes = await new Bun.Image(imageBuffer).png().bytes();
    const base64 = Buffer.from(pngBytes).toString("base64");
    return `\x1b]1337;File=inline=1;width=${widthPercentage}%:${base64}\x07`;
  }

  async #renderAnsiBlocks(
    imageBuffer: Uint8Array,
    widthPercentage: number,
  ): Promise<string> {
    const columns = this.#terminal.columns();
    const rows = this.#terminal.rows();
    const targetWidth = Math.floor(columns * widthPercentage / 100);

    const meta = await new Bun.Image(imageBuffer).metadata();
    const aspectRatio = meta.height! / meta.width!;
    let targetHeight = Math.round(targetWidth * aspectRatio);
    if (targetHeight % 2 !== 0) targetHeight++;
    const maxHeight = (rows - 2) * 2;
    if (targetHeight > maxHeight) targetHeight = maxHeight;

    const resizedPng = await new Bun.Image(imageBuffer)
      .resize(targetWidth, targetHeight, { fit: "inside" })
      .png()
      .bytes();
    const { width, height, pixels } = decodePngToRGBA(resizedPng);

    const lines: string[] = [];
    for (let y = 0; y < height; y += 2) {
      let line = "";
      const hasBottom = y + 1 < height;
      for (let x = 0; x < width; x++) {
        const topIdx = (y * width + x) * 4;
        const r = pixels[topIdx]!;
        const g = pixels[topIdx + 1]!;
        const b = pixels[topIdx + 2]!;
        const a = pixels[topIdx + 3]!;

        if (hasBottom) {
          const botIdx = ((y + 1) * width + x) * 4;
          const r2 = pixels[botIdx]!;
          const g2 = pixels[botIdx + 1]!;
          const b2 = pixels[botIdx + 2]!;

          if (a === 0) {
            line += foregroundColorStart(r2, g2, b2) + "▄" +
              FOREGROUND_COLOR_END;
          } else {
            line += backgroundColorStart(r, g, b) +
              foregroundColorStart(r2, g2, b2) + "▄" +
              FOREGROUND_COLOR_END + BACKGROUND_COLOR_END;
          }
        } else {
          if (a === 0) {
            line += " ";
          } else {
            line += backgroundColorStart(r, g, b) + " " + BACKGROUND_COLOR_END;
          }
        }
      }
      lines.push(line);
    }
    return lines.join("\n");
  }
}
