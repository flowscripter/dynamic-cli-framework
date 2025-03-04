import { COLOR_END, ITALIC_END, ITALIC_START } from "./Ansi.ts";
import Styler from "./Styler.ts";

export default class TtyStyler implements Styler {
  colorEnabled: boolean = true;

  readonly colorLevel: number;

  /**
   * The color level in use.
   *
   * 1 = 16 color
   * 2 = 256 color
   * 3 = 16 million color
   */
  constructor(colorLevel: number = 1) {
    this.colorLevel = colorLevel;
  }

  colorText(text: string, colorValue: number): string {
    if (!this.colorEnabled) {
      return text;
    }

    if (this.colorLevel === 3) {
      return Bun.color(colorValue, "ansi-16m") + text + COLOR_END;
    }

    if (this.colorLevel === 2) {
      return Bun.color(colorValue, "ansi-256") + text + COLOR_END;
    }

    return Bun.color(colorValue, "ansi-16") + text + COLOR_END;
  }

  italicText(text: string): string {
    return ITALIC_START + text + ITALIC_END;
  }
}
