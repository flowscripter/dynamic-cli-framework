import AsciiBannerGeneratorService from "../../api/service/core/AsciiBannerGeneratorService.ts";
import { figlet_factory, figlet_serializer } from "../../../deps.ts";

// FIGlet font is converted to a JSON string and embedded in a simple JSON file: `{ "font": "<figlet font definition>" }`
import { font as standardFont } from "./standard.flf.json" assert { type: "json" };

/**
 * Default implementation of {@link AsciiBannerGeneratorService} which has a font definition
 * for the FIGlet "standard" font already registered.
 */
export default class DefaultAsciiBannerGeneratorService
  implements AsciiBannerGeneratorService {
  private fontDefinitionsByName: Map<string, string> = new Map();
  private fontDictionariesByName: Map<string, string> = new Map();

  constructor() {
    this.registerFont("standard", standardFont);
  }
  getRegisteredFonts(): ReadonlyArray<string> {
    return Array.from(this.fontDefinitionsByName.keys());
  }

  registerFont(fontName: string, fontDefinition: string): void {
    const name = fontName.toLowerCase();
    if (this.getRegisteredFonts().includes(name)) {
      throw new Error(`Font name already registered: ${name}`);
    }
    this.fontDefinitionsByName.set(name, fontDefinition);
  }

  async generate(message: string, fontName: string): Promise<string> {
    const name = fontName.toLowerCase();
    if (!this.getRegisteredFonts().includes(name)) {
      throw new Error(`Syntax name is not registered: ${name}`);
    }

    let dictionary = this.fontDictionariesByName.get(name);
    if (!dictionary) {
      dictionary = await figlet_serializer(
        this.fontDefinitionsByName.get(name),
      );
      this.fontDictionariesByName.set(name, dictionary as string);
    }
    return await figlet_factory(message, dictionary);
  }
}
