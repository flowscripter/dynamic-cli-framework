import { COLOR_END, ITALIC_END, ITALIC_START } from "./Ansi.ts";
import Styler from "./Styler.ts";

export default class TtyStyler implements Styler {
  colorEnabled: boolean = true;

  colorText(text: string, colorValue: number): string {
    if (!this.colorEnabled) {
      return text;
    }
    return Bun.color(colorValue, "ansi") + text + COLOR_END;
  }

  italicText(text: string): string {
    return ITALIC_START + text + ITALIC_END;
  }
}
