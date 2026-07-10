import { WriteStream } from "node:tty";
import type Terminal from "./Terminal.ts";

export default class NonTtyTerminal implements Terminal {
  readonly #writeStream: NodeJS.WritableStream;
  readonly #encoder = new TextEncoder();

  constructor(writeStream: NodeJS.WritableStream) {
    if ((writeStream as WriteStream).isTTY === true) {
      throw new Error("The provided WriteStream is a TTY");
    }

    this.#writeStream = writeStream;
  }

  write(text: string): Promise<void> {
    this.#writeStream.write(this.#encoder.encode(text));
    return Promise.resolve();
  }

  columns(): number {
    return 80;
  }

  rows(): number {
    return 24;
  }

  clearLine(): Promise<void> {
    return Promise.reject(new Error("clearLine() is not supported on a non-TTY terminal"));
  }

  clearUpLines(_count: number): Promise<void> {
    return Promise.reject(new Error("clearUpLines() is not supported on a non-TTY terminal"));
  }

  hideCursor(): Promise<void> {
    return Promise.reject(new Error("hideCursor() is not supported on a non-TTY terminal"));
  }

  showCursor(): Promise<void> {
    return Promise.reject(new Error("showCursor() is not supported on a non-TTY terminal"));
  }

  isTty(): boolean {
    return false;
  }
}
