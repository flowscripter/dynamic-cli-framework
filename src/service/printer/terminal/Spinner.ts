import type Styler from "../../../terminal/Styler.ts";
import type Terminal from "../../../terminal/Terminal.ts";

const BOX_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const STAR_FRAMES = ["★", "✶", "✷", "✹", "✷", "✶", "★", "✦"];

const SHOW_DELAY_MILLIS = 100;

export { SpinnerStyle } from "@flowscripter/dynamic-cli-framework-api";
import { SpinnerStyle } from "@flowscripter/dynamic-cli-framework-api";

export default class Spinner {
  #isShown = false;
  #isRendering = false;
  #message: string | undefined;
  #frameIndex = 0;
  #timer: Timer | undefined;
  #showDelayTimer: Timer | undefined;
  #renderInFlight: Promise<void> | undefined;
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
        `${this.#styler.colorText(
          frames[this.#frameIndex]!,
          this.#spinColor,
        )} ${this.#styler.colorText(this.#message!, this.#msgColor)}`,
      );
    } else {
      await this.#terminal.write(
        this.#styler.colorText(frames[this.#frameIndex]!, this.#spinColor),
      );
    }
    this.#frameIndex = (this.#frameIndex + 1) % frames.length;
  }

  #startTimer(): void {
    this.#timer = setInterval(() => {
      const renderPromise = this.#nextFrame();
      this.#renderInFlight = renderPromise;
      void renderPromise.finally(() => {
        if (this.#renderInFlight === renderPromise) {
          this.#renderInFlight = undefined;
        }
      });
    }, 100);
  }

  async #beginRendering(): Promise<void> {
    this.#isRendering = true;
    this.#startTimer();
    await this.#terminal.hideCursor();
  }

  #scheduleShow(): void {
    this.#showDelayTimer = setTimeout(() => {
      this.#showDelayTimer = undefined;
      void this.#beginRendering();
    }, SHOW_DELAY_MILLIS);
  }

  public async show(message?: string): Promise<void> {
    this.#message = message;
    if (this.#isShown) {
      return Promise.resolve();
    }
    this.#isShown = true;
    this.#frameIndex = 0;
    this.#scheduleShow();
    return Promise.resolve();
  }

  public async hide(): Promise<void> {
    if (!this.#isShown) {
      return Promise.resolve();
    }
    this.#isShown = false;
    this.#message = undefined;
    if (this.#showDelayTimer) {
      clearTimeout(this.#showDelayTimer);
      this.#showDelayTimer = undefined;
      return;
    }
    this.#isRendering = false;
    clearInterval(this.#timer);
    this.#timer = undefined;
    if (this.#renderInFlight) {
      await this.#renderInFlight;
    }
    await this.#terminal.clearLine();
    await this.#terminal.showCursor();
  }

  public async pause(): Promise<void> {
    if (!this.#isShown) {
      return Promise.resolve();
    }
    if (this.#showDelayTimer) {
      clearTimeout(this.#showDelayTimer);
      this.#showDelayTimer = undefined;
      return;
    }
    clearInterval(this.#timer);
    this.#timer = undefined;
    if (this.#renderInFlight) {
      await this.#renderInFlight;
    }
    await this.#terminal.clearLine();
  }

  public resume(): void {
    if (!this.#isShown || this.#timer !== undefined || this.#showDelayTimer !== undefined) {
      return;
    }
    if (this.#isRendering) {
      this.#startTimer();
    } else {
      this.#scheduleShow();
    }
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
