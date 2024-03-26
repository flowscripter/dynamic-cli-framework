import {
  CLEAR_LINE,
  CURSOR_LEFT,
  CURSOR_UP,
  HIDE_CURSOR,
  SHOW_CURSOR,
} from "./Ansi.ts";

export default class Terminal {
  readonly #writableStream: WritableStream;
  readonly #encoder = new TextEncoder();

  constructor(writableStream: WritableStream) {
    this.#writableStream = writableStream;
  }

  async #writeAll(message: string): Promise<void> {
    const encoded = this.#encoder.encode(message);
    const writer = this.#writableStream.getWriter();

    await writer.ready;
    await writer.write(encoded);

    writer.releaseLock();
  }

  async clearLine(): Promise<void> {
    await this.#writeAll(CLEAR_LINE + CURSOR_LEFT);
  }

  async clearUpLines(count: number): Promise<void> {
    await this.#writeAll(
      (CURSOR_UP + CLEAR_LINE).repeat(count) + CLEAR_LINE + CURSOR_LEFT,
    );
  }

  async hideCursor(): Promise<void> {
    await this.#writeAll(HIDE_CURSOR);
  }

  async showCursor(): Promise<void> {
    await this.#writeAll(SHOW_CURSOR);
  }

  async write(text: string): Promise<void> {
    await this.#writeAll(text);
  }

  columns(): number {
    try {
      return Deno.consoleSize().columns;
    } catch {
      return 80;
    }
  }
}
