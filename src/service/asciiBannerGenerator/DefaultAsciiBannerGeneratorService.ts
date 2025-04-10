import type AsciiBannerGeneratorService from "../../api/service/core/AsciiBannerGeneratorService.ts";
import figlet from "figlet";
// FIGlet font is converted to a JSON string and embedded in a simple JSON file: `{ "font": "<figlet font definition>" }`
import standardFont from "./standard.flf.json" with { type: "json" };

/**
 * Default implementation of {@link AsciiBannerGeneratorService} which has a font definition
 * for the FIGlet "standard" font already registered.
 */
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

  async generate(message: string, fontName: string): Promise<string> {
    const name = fontName.toLowerCase();
    if (!this.getRegisteredFonts().includes(name)) {
      throw new Error(`Font name is not registered: ${name}`);
    }

    const bannerText = await figlet.text(message, { font: name });
    const lines = bannerText.split("\n");

    // Remove any whitespace lines from the end
    while (
      (lines.length > 0) && (lines[lines.length - 1].trim().length === 0)
    ) {
      lines.pop();
    }

    return "\n" + lines.join("\n") + "\n";
  }
}
