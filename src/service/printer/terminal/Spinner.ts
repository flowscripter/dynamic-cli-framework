import { colors } from "../../../../deps.ts";
import Terminal from "./Terminal.ts";

const FRAMES = [
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

export default class Spinner {
  private isShown = false;
  private message: string | undefined;
  private frameIndex = 0;
  private intervalId: number | undefined;
  private spinColor = 0x8a8a8a;
  private msgColor = 0x808080;
  private readonly terminal: Terminal;

  public constructor(writer: Deno.Writer) {
    this.terminal = new Terminal(writer);
  }

  private async nextFrame(): Promise<void> {
    if (!this.isShown) {
      return;
    }
    await this.terminal.clearLine();
    if (this.message) {
      await this.terminal.write(
        `${colors.rgb24(FRAMES[this.frameIndex], this.spinColor)} ${
          colors.rgb24(this.message!, this.msgColor)
        }`,
      );
    } else {
      await this.terminal.write(
        colors.rgb24(FRAMES[this.frameIndex], this.spinColor),
      );
    }
    this.frameIndex = (this.frameIndex + 1) % FRAMES.length;
  }

  public async show(message?: string): Promise<void> {
    this.message = message;
    if (this.isShown) {
      return Promise.resolve();
    }
    this.isShown = true;
    this.frameIndex = 0;
    this.intervalId = setInterval(async () => {
      await this.nextFrame();
    }, 100);
    await this.terminal.hideCursor();
  }

  public async hide(): Promise<void> {
    if (!this.isShown) {
      return Promise.resolve();
    }
    this.isShown = false;
    clearInterval(this.intervalId);
    await this.terminal.clearLine();
    await this.terminal.showCursor();
    this.message = undefined;
  }

  public async pause(): Promise<void> {
    if (!this.isShown) {
      return Promise.resolve();
    }
    clearInterval(this.intervalId);
    delete this.intervalId;
    await this.terminal.clearLine();
  }

  public resume(): void {
    if ((!this.isShown) || (this.intervalId !== undefined)) {
      return;
    }
    this.intervalId = setInterval(async () => {
      await this.nextFrame();
    }, 100);
  }

  set spinnerColor(color: number) {
    this.spinColor = color;
  }

  set messageColor(color: number) {
    this.msgColor = color;
  }
}
