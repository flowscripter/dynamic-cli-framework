import { WriteStream } from "node:tty";
import type Terminal from "./Terminal.ts";

import {
  CLEAR_LINE,
  CURSOR_LEFT,
  CURSOR_UP,
  HIDE_CURSOR,
  SHOW_CURSOR,
} from "./Ansi.ts";

export default class TtyTerminal implements Terminal {
  readonly #ttyWriteStream: WriteStream;
  readonly #encoder = new TextEncoder();

  constructor(ttyWriteStream: WriteStream) {
    if (ttyWriteStream.isTTY === false) {
      throw new Error("The provided WriteStream is not a TTY");
    }

    this.#ttyWriteStream = ttyWriteStream;
  }

  #writeAll(message: string): void {
    const encoded = this.#encoder.encode(message);

    this.#ttyWriteStream.write(encoded);
  }

  clearLine(): Promise<void> {
    this.#writeAll(CLEAR_LINE + CURSOR_LEFT);

    return Promise.resolve();
  }

  clearUpLines(count: number): Promise<void> {
    this.#writeAll(
      (CURSOR_UP + CLEAR_LINE).repeat(count) + CLEAR_LINE + CURSOR_LEFT,
    );
    return Promise.resolve();
  }

  hideCursor(): Promise<void> {
    this.#writeAll(HIDE_CURSOR);
    return Promise.resolve();
  }

  showCursor(): Promise<void> {
    this.#writeAll(SHOW_CURSOR);
    return Promise.resolve();
  }

  write(text: string): Promise<void> {
    this.#writeAll(text);
    return Promise.resolve();
  }

  columns(): number {
    try {
      return this.#ttyWriteStream.columns;
    } catch {
      return 80;
    }
  }
}
