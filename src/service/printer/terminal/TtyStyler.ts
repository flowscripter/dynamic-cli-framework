import {
  BACKGROUND_COLOR_END,
  FOREGROUND_COLOR_END,
  ITALIC_END,
  ITALIC_START,
} from "./Ansi.ts";
import type Styler from "./Styler.ts";

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
      return Bun.color(colorValue, "ansi-16m") + text + FOREGROUND_COLOR_END;
    }

    if (this.colorLevel === 2) {
      return Bun.color(colorValue, "ansi-256") + text + FOREGROUND_COLOR_END;
    }

    return Bun.color(colorValue, "ansi-16") + text + FOREGROUND_COLOR_END;
  }

  backgroundColorText(text: string, colorValue: number): string {
    if (!this.colorEnabled) {
      return text;
    }

    if (this.colorLevel === 3) {
      const r = (colorValue >> 16) & 0xFF;
      const g = (colorValue >> 8) & 0xFF;
      const b = colorValue & 0xFF;
      return `\x1b[48;2;${r};${g};${b}m${text}${BACKGROUND_COLOR_END}`;
    }

    if (this.colorLevel === 2) {
      return Bun.color(colorValue, "ansi-256")!.replace("[38;", "[48;") + text +
        BACKGROUND_COLOR_END;
    }

    return Bun.color(colorValue, "ansi-16")!.replace(
      /\[(\d+)m/,
      (_, n) => `[${Number(n) + 10}m`,
    ) + text + BACKGROUND_COLOR_END;
  }

  italicText(text: string): string {
    return ITALIC_START + text + ITALIC_END;
  }
}
