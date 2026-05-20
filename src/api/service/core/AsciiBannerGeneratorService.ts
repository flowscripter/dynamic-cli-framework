export const ASCII_BANNER_GENERATOR_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/ascii-banner-generator-service";

export type ColorEffectDirection = "horizontal" | "vertical";

export interface FixedColorEffect {
  type: "fixed";
  color: string; // hex "#rrggbb"
}

export interface GradientColorEffect {
  type: "gradient";
  colors: string[]; // 2+ hex color stops
  direction: ColorEffectDirection;
}

export interface RainbowColorEffect {
  type: "rainbow";
  spread?: number; // default 8.0
  frequency?: number; // default 0.3
  seed?: number; // default 0 = random seed
  direction: ColorEffectDirection;
}

export type ColorEffect =
  | FixedColorEffect
  | GradientColorEffect
  | RainbowColorEffect;

export interface BannerColorEffects {
  background?: ColorEffect;
  messageForeground?: ColorEffect;
  subMessageForeground?: ColorEffect;
}

export interface BannerGenerateOptions {
  fontName?: string;
  subMessage?: string;
  colorEffects?: BannerColorEffects;
}

/**
 * Service allowing a text string to be rendered using an ASCII banner font.
 */
export default interface AsciiBannerGeneratorService {
  /**
   * Register a new font.
   *
   * The recommended way to load the font definition is to convert the font definition to a JSON string
   * (replacing newlines with `\n`) and placing in a simple JSON file: `{ "font": "<figlet font definition>" }`.
   * This can then be imported as follows:
   *
   * `import { font as myFont } from "./myfont.json" with { type: "json" };`
   *
   * @param fontName the name used to refer to the font.
   * @param fontDefinition the definition for the syntax conforming to the FIGfont format.
   */
  registerFont(fontName: string, fontDefinition: string): void;

  /**
   * Return the names of the currently registered fonts.
   */
  getRegisteredFonts(): ReadonlyArray<string>;

  /**
   * Generate an ASCII banner text for the message using the specified options.
   *
   * @param message the message to output.
   * @param options optional generation options.
   */
  generate(message: string, options?: BannerGenerateOptions): Promise<string>;
}
