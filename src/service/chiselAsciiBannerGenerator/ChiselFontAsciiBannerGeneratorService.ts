import type AsciiBannerGeneratorService from "../../api/service/core/AsciiBannerGeneratorService.ts";
import type { BannerGenerateOptions } from "../../api/service/core/AsciiBannerGeneratorService.ts";
import DefaultAsciiBannerGeneratorService from "../asciiBannerGenerator/DefaultAsciiBannerGeneratorService.ts";
import figlet from "figlet";
import chiselFont from "./chisel.flf.json" with { type: "json" };

export interface ChiselBannerColors {
  highlightForeground?: number; // default 97
  highlightBackground?: number; // default 107
  lightForeground?: number; // default 37
  lightBackground?: number; // default 47
  shadowForeground?: number; // default 90
  shadowBackground?: number; // default 100
}

export interface ChiselBannerGenerateOptions extends BannerGenerateOptions {
  chiselColors?: ChiselBannerColors;
}

export default class ChiselFontAsciiBannerGeneratorService
  extends DefaultAsciiBannerGeneratorService
  implements AsciiBannerGeneratorService {
  private _ready = false;

  constructor() {
    super();
    this._ready = true;
    figlet.parseFont("chisel", chiselFont.font);
  }

  override registerFont(_fontName: string, _fontDefinition: string): void {
    if (this._ready) {
      throw new Error(
        "ChiselFontAsciiBannerGeneratorService supports only the built-in chisel font",
      );
    }
  }

  override getRegisteredFonts(): ReadonlyArray<string> {
    return ["chisel"];
  }

  override async generate(
    message: string,
    options?: ChiselBannerGenerateOptions,
  ): Promise<string> {
    const chiselOptions: BannerGenerateOptions = {
      ...options,
      fontName: "chisel",
    };

    let result = await super.generate(message, chiselOptions);

    if (options?.chiselColors) {
      const colors = options.chiselColors;
      const colorMap: Record<string, number> = {};
      if (colors.highlightForeground !== undefined) {
        colorMap["97"] = colors.highlightForeground;
      }
      if (colors.highlightBackground !== undefined) {
        colorMap["107"] = colors.highlightBackground;
      }
      if (colors.lightForeground !== undefined) {
        colorMap["37"] = colors.lightForeground;
      }
      if (colors.lightBackground !== undefined) {
        colorMap["47"] = colors.lightBackground;
      }
      if (colors.shadowForeground !== undefined) {
        colorMap["90"] = colors.shadowForeground;
      }
      if (colors.shadowBackground !== undefined) {
        colorMap["100"] = colors.shadowBackground;
      }

      result = result.replace(
        // deno-lint-ignore no-control-regex
        /\x1b\[(\d+)m/g,
        (_, n) => `\x1b[${colorMap[n] ?? n}m`,
      );
    }

    return result;
  }
}
