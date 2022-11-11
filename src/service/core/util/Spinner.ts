import { colors, conversions } from "../../../../deps.ts";

const ESC = "\x1b[";
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
  private readonly writer: Deno.Writer;
  private encoder = new TextEncoder();
  private spinColor = 0x8a8a8a;
  private msgColor = 0x808080;
  public constructor(writer: Deno.Writer) {
    this.writer = writer;
  }

  private async clearLine() {
    await conversions.writeAll(this.writer, this.encoder.encode(ESC + "2K\r"));
  }

  private async hideCursor(): Promise<void> {
    await conversions.writeAll(this.writer, this.encoder.encode(ESC + "?25l"));
  }

  private async showCursor(): Promise<void> {
    await conversions.writeAll(this.writer, this.encoder.encode(ESC + "?25h"));
  }

  private async nextFrame(): Promise<void> {
    await this.clearLine();
    if (this.message) {
      await conversions.writeAll(
        this.writer,
        this.encoder.encode(
          `${colors.rgb24(FRAMES[this.frameIndex], this.spinColor)} ${
            colors.rgb24(this.message!, this.msgColor)
          }`,
        ),
      );
    } else {
      await conversions.writeAll(
        this.writer,
        this.encoder.encode(
          colors.rgb24(FRAMES[this.frameIndex], this.spinColor),
        ),
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
    await this.hideCursor();
  }

  public async hide(): Promise<void> {
    if (!this.isShown) {
      return Promise.resolve();
    }
    this.isShown = false;
    clearInterval(this.intervalId);
    await this.clearLine();
    await this.showCursor();
    this.message = undefined;
  }

  set spinnerColor(color: number) {
    this.spinColor = color;
  }

  set messageColor(color: number) {
    this.msgColor = color;
  }
}
