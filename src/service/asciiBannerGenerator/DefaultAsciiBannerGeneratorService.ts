import type AsciiBannerGeneratorService from "../../api/service/core/AsciiBannerGeneratorService.ts";
import type {
  BannerGenerateOptions,
  ColorEffect,
} from "../../api/service/core/AsciiBannerGeneratorService.ts";
import {
  backgroundColorStart,
  BACKGROUND_COLOR_END,
  foregroundColorStart,
  FOREGROUND_COLOR_END,
} from "../printer/terminal/Ansi.ts";
import figlet from "figlet";
import standardFont from "./standard.flf.json" with { type: "json" };

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 1 / 6) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 2 / 6) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 3 / 6) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 4 / 6) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 5 / 6) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function parseHex(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
}

function interpolateColors(
  colorStops: [number, number, number][],
  position: number,
  total: number,
): [number, number, number] {
  const first = colorStops[0];
  if (total <= 1 || first === undefined) return first ?? [0, 0, 0];
  const t = position / (total - 1);
  const scaledT = t * (colorStops.length - 1);
  const idx = Math.min(Math.floor(scaledT), colorStops.length - 2);
  const localT = scaledT - idx;
  const stop1 = colorStops[idx];
  const stop2 = colorStops[idx + 1];
  if (stop1 === undefined || stop2 === undefined) return first;
  const [r1, g1, b1] = stop1;
  const [r2, g2, b2] = stop2;
  return [
    Math.round(r1 + (r2 - r1) * localT),
    Math.round(g1 + (g2 - g1) * localT),
    Math.round(b1 + (b2 - b1) * localT),
  ];
}

function rainbowColor(
  freq: number,
  spread: number,
  seed: number,
  x: number,
  y: number,
): [number, number, number] {
  const h = ((freq * (x / spread) + seed + y * freq / spread) % 1.0 + 1.0) %
    1.0;
  return hslToRgb(h, 1.0, 0.5);
}


export default class DefaultAsciiBannerGeneratorService
  implements AsciiBannerGeneratorService {
  #registeredFontNames: Array<string> = [];

  constructor() {
    this.registerFont("standard", standardFont.font);
  }

  getRegisteredFonts(): ReadonlyArray<string> {
    return this.#registeredFontNames;
  }

  registerFont(fontName: string, fontDefinition: string): void {
    const name = fontName.toLowerCase();
    if (this.getRegisteredFonts().includes(name)) {
      throw new Error(`Font name already registered: ${name}`);
    }
    this.#registeredFontNames.push(name);
    figlet.parseFont(fontName, fontDefinition);
  }

  protected applyForegroundEffect(
    lines: string[],
    effect: ColorEffect,
  ): string[] {
    if (effect.type === "fixed") {
      const [r, g, b] = parseHex(effect.color);
      const code = foregroundColorStart(r, g, b);
      return lines.map((line) =>
        line.split("").map((ch) => ch === " " ? ch : code + ch + FOREGROUND_COLOR_END).join(
          "",
        )
      );
    }
    if (effect.type === "gradient") {
      const colorStops = effect.colors.map(parseHex);
      return lines.map((line, yi) => {
        if (effect.direction === "vertical") {
          const [r, g, b] = interpolateColors(
            colorStops,
            yi,
            Math.max(lines.length, 1),
          );
          const code = foregroundColorStart(r, g, b);
          return line.split("").map((ch) =>
            ch === " " ? ch : code + ch + FOREGROUND_COLOR_END
          ).join("");
        }
        const nonSpaceCount = line.split("").filter((c) => c !== " ").length;
        let charIdx = 0;
        return line.split("").map((ch) => {
          if (ch === " ") return ch;
          const [r, g, b] = interpolateColors(
            colorStops,
            charIdx,
            Math.max(nonSpaceCount, 1),
          );
          charIdx++;
          return foregroundColorStart(r, g, b) + ch + FOREGROUND_COLOR_END;
        }).join("");
      });
    }
    const freq = effect.frequency ?? 0.3;
    const spread = effect.spread ?? 8.0;
    const seed = effect.seed ?? Math.random();
    return lines.map((line, yi) => {
      if (effect.direction === "vertical") {
        const [r, g, b] = rainbowColor(freq, spread, seed, 0, yi);
        const code = foregroundColorStart(r, g, b);
        return line.split("").map((ch) =>
          ch === " " ? ch : code + ch + FOREGROUND_COLOR_END
        ).join("");
      }
      let charIdx = 0;
      return line.split("").map((ch) => {
        if (ch === " ") return ch;
        const [r, g, b] = rainbowColor(freq, spread, seed, charIdx, yi);
        charIdx++;
        return foregroundColorStart(r, g, b) + ch + FOREGROUND_COLOR_END;
      }).join("");
    });
  }

  protected applyBackgroundEffect(
    lines: string[],
    effect: ColorEffect,
  ): string[] {
    if (effect.type === "fixed") {
      const [r, g, b] = parseHex(effect.color);
      const code = backgroundColorStart(r, g, b);
      return lines.map((line) => code + line + BACKGROUND_COLOR_END);
    }
    if (effect.type === "gradient") {
      const colorStops = effect.colors.map(parseHex);
      return lines.map((line, yi) => {
        if (effect.direction === "vertical") {
          const [r, g, b] = interpolateColors(
            colorStops,
            yi,
            Math.max(lines.length, 1),
          );
          return backgroundColorStart(r, g, b) + line + BACKGROUND_COLOR_END;
        }
        const totalChars = Math.max(line.length, 1);
        return line.split("").map((ch, xi) => {
          const [r, g, b] = interpolateColors(colorStops, xi, totalChars);
          return backgroundColorStart(r, g, b) + ch + BACKGROUND_COLOR_END;
        }).join("");
      });
    }
    const freq = effect.frequency ?? 0.3;
    const spread = effect.spread ?? 8.0;
    const seed = effect.seed ?? Math.random();
    return lines.map((line, yi) => {
      if (effect.direction === "vertical") {
        const [r, g, b] = rainbowColor(freq, spread, seed, 0, yi);
        return backgroundColorStart(r, g, b) + line + BACKGROUND_COLOR_END;
      }
      return line.split("").map((ch, xi) => {
        const [r, g, b] = rainbowColor(freq, spread, seed, xi, yi);
        return backgroundColorStart(r, g, b) + ch + BACKGROUND_COLOR_END;
      }).join("");
    });
  }

  async generate(
    message: string,
    options?: BannerGenerateOptions,
  ): Promise<string> {
    const fontName = (options?.fontName ?? "standard").toLowerCase();
    if (!this.getRegisteredFonts().includes(fontName)) {
      throw new Error(`Font name is not registered: ${fontName}`);
    }

    const bannerText = await figlet.text(message, { font: fontName });
    let titleLines = bannerText.split("\n");

    while (titleLines.length > 0) {
      const last = titleLines[titleLines.length - 1];
      if (last === undefined || last.trim().length > 0) break;
      titleLines.pop();
    }

    let subMessageLine: string | undefined;
    if (options?.subMessage) {
      subMessageLine = options.subMessage
        .toUpperCase()
        .split("")
        .map((c) => c === " " ? "  " : c + " ")
        .join("")
        .trimEnd();

      const bannerWidth = Math.max(...titleLines.map((l) => l.length));
      const subWidth = subMessageLine.length;

      if (bannerWidth >= subWidth) {
        const pad = Math.floor((bannerWidth - subWidth) / 2);
        subMessageLine = " ".repeat(pad) + subMessageLine;
      } else {
        const pad = Math.floor((subWidth - bannerWidth) / 2);
        titleLines = titleLines.map((l) => " ".repeat(pad) + l);
      }
    }

    const colorEffects = options?.colorEffects;

    if (colorEffects?.messageForeground) {
      titleLines = this.applyForegroundEffect(
        titleLines,
        colorEffects.messageForeground,
      );
    }

    let subLines: string[] | undefined;
    if (subMessageLine !== undefined) {
      subLines = [subMessageLine];
      if (colorEffects?.subMessageForeground) {
        subLines = this.applyForegroundEffect(
          subLines,
          colorEffects.subMessageForeground,
        );
      }
    }

    let allLines = subLines ? [...titleLines, ...subLines] : titleLines;

    if (colorEffects?.background) {
      allLines = this.applyBackgroundEffect(allLines, colorEffects.background);
    }

    return "\n" + allLines.join("\n") + "\n";
  }
}
