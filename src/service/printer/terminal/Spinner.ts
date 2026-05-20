import type Styler from "../../../terminal/Styler.ts";
import type Terminal from "../../../terminal/Terminal.ts";

const BOX_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
];

const STAR_FRAMES = [
  "★",
  "✶",
  "✷",
  "✹",
  "✷",
  "✶",
  "★",
  "✦",
];

export enum SpinnerStyle {
  BOX = "BOX",
  STAR = "STAR",
}

export default class Spinner {
  #isShown = false;
  #message: string | undefined;
  #frameIndex = 0;
  #timer: Timer | undefined;
  #spinColor = 0x8a8a8a;
  #msgColor = 0x808080;
  #style: SpinnerStyle = SpinnerStyle.BOX;
  readonly #terminal: Terminal;
  readonly #styler: Styler;

  public constructor(terminal: Terminal, styler: Styler) {
    this.#terminal = terminal;
    this.#styler = styler;
  }

  get #frames(): string[] {
    return this.#style === SpinnerStyle.STAR ? STAR_FRAMES : BOX_FRAMES;
  }

  async #nextFrame(): Promise<void> {
    if (!this.#isShown) {
      return;
    }
    const frames = this.#frames;
    await this.#terminal.clearLine();
    if (this.#message) {
      await this.#terminal.write(
        `${
          this.#styler.colorText(frames[this.#frameIndex]!, this.#spinColor)
        } ${this.#styler.colorText(this.#message!, this.#msgColor)}`,
      );
    } else {
      await this.#terminal.write(
        this.#styler.colorText(frames[this.#frameIndex]!, this.#spinColor),
      );
    }
    this.#frameIndex = (this.#frameIndex + 1) % frames.length;
  }

  public async show(message?: string): Promise<void> {
    this.#message = message;
    if (this.#isShown) {
      return Promise.resolve();
    }
    this.#isShown = true;
    this.#frameIndex = 0;
    this.#timer = setInterval(async () => {
      await this.#nextFrame();
    }, 100);
    await this.#terminal.hideCursor();
  }

  public async hide(): Promise<void> {
    if (!this.#isShown) {
      return Promise.resolve();
    }
    this.#isShown = false;
    clearInterval(this.#timer);
    await this.#terminal.clearLine();
    await this.#terminal.showCursor();
    this.#message = undefined;
  }

  public async pause(): Promise<void> {
    if (!this.#isShown) {
      return Promise.resolve();
    }
    clearInterval(this.#timer);
    this.#timer = undefined;
    await this.#terminal.clearLine();
  }

  public resume(): void {
    if ((!this.#isShown) || (this.#timer !== undefined)) {
      return;
    }
    this.#timer = setInterval(async () => {
      await this.#nextFrame();
    }, 100);
  }

  set spinnerColor(color: number) {
    this.#spinColor = color;
  }

  set messageColor(color: number) {
    this.#msgColor = color;
  }

  set spinnerStyle(style: SpinnerStyle) {
    this.#style = style;
  }
}
