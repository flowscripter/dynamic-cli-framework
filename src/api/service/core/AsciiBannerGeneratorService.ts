export const ASCII_BANNER_GENERATOR_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/ascii-banner-generator-service";

/**
 * Service allowing a text string to be rendered using an ASCII banner [FIGlet](http://www.figlet.org) font.
 */
export default interface AsciiBannerGeneratorService {
  /**
   * Register a new font.
   *
   * The recommended way to load the font definition is to convert the font definition to a JSON string
   * (replacing newlines with `\n`) and placing in a simple JSON file: `{ "font": "<figlet font definition>" }`.
   * This can then be imported as follows:
   *
   * `import { font as myFont } from "./myfont.json" with { type: "json" };
   *
   * @param fontName the name used to refer to the font.
   * @param fontDefinition the definition for the syntax conforming to the
   * [FIGfont format](http://www.jave.de/figlet/figfont.html#creating).
   */
  registerFont(fontName: string, fontDefinition: string): void;

  /**
   * Return the names of the currently registered fonts.
   */
  getRegisteredFonts(): ReadonlyArray<string>;

  /**
   * Generate an ASCII banner text for the message using the specified font.
   *
   * @param message the message to output.
   * @param fontName the font to use.
   */
  generate(message: string, fontName: string): Promise<string>;
}
