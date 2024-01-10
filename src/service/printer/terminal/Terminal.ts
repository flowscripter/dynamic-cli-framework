import { conversions } from "../../../../deps.ts";
import {
  CLEAR_LINE,
  CURSOR_LEFT,
  CURSOR_UP,
  HIDE_CURSOR,
  SHOW_CURSOR,
} from "./Ansi.ts";

export default class Terminal {
  private readonly writer: Deno.Writer;
  private readonly encoder = new TextEncoder();

  constructor(writer: Deno.Writer) {
    this.writer = writer;
  }

  async clearLine(): Promise<void> {
    await conversions.writeAll(
      this.writer,
      this.encoder.encode(CLEAR_LINE + CURSOR_LEFT),
    );
  }

  async clearUpLines(count: number): Promise<void> {
    await conversions.writeAll(
      this.writer,
      this.encoder.encode(
        (CURSOR_UP + CLEAR_LINE).repeat(count) + CLEAR_LINE + CURSOR_LEFT,
      ),
    );
  }

  async hideCursor(): Promise<void> {
    await conversions.writeAll(this.writer, this.encoder.encode(HIDE_CURSOR));
  }

  async showCursor(): Promise<void> {
    await conversions.writeAll(this.writer, this.encoder.encode(SHOW_CURSOR));
  }

  async write(text: string): Promise<void> {
    await conversions.writeAll(
      this.writer,
      this.encoder.encode(text),
    );
  }
}
