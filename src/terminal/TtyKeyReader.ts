import { ReadStream } from "node:tty";
import { Buffer } from "node:buffer";
import type KeyReader from "./KeyReader.ts";
import { type KeyEvent, SpecialKey } from "./KeyReader.ts";

export default class TtyKeyReader implements KeyReader {
  readonly #ttyReadStream: ReadStream;

  constructor(ttyReadStream: ReadStream) {
    if (ttyReadStream.isTTY === false) {
      throw new Error("The provided ReadStream is not a TTY");
    }
    this.#ttyReadStream = ttyReadStream;
  }

  enableRawMode(): void {
    this.#ttyReadStream.setRawMode(true);
    this.#ttyReadStream.resume();
  }

  disableRawMode(): void {
    this.#ttyReadStream.setRawMode(false);
    this.#ttyReadStream.pause();
  }

  readKey(): Promise<KeyEvent> {
    return new Promise((resolve) => {
      const onData = (data: Buffer): void => {
        this.#ttyReadStream.removeListener("data", onData);
        resolve(TtyKeyReader.#decodeKeyEvent(data));
      };
      this.#ttyReadStream.on("data", onData);
    });
  }

  static #decodeKeyEvent(data: Buffer): KeyEvent {
    if (data.length === 0) {
      return {};
    }

    // escape sequences
    if (data[0] === 0x1b) {
      if (data.length === 1) {
        return { specialKey: SpecialKey.ESCAPE };
      }
      if (data.length >= 3 && data[1] === 0x5b) {
        switch (data[2]) {
          case 0x41:
            return { specialKey: SpecialKey.UP };
          case 0x42:
            return { specialKey: SpecialKey.DOWN };
          case 0x43:
            return { specialKey: SpecialKey.RIGHT };
          case 0x44:
            return { specialKey: SpecialKey.LEFT };
        }
      }
      return { specialKey: SpecialKey.ESCAPE };
    }

    // control characters
    switch (data[0]) {
      case 0x0d:
        return { specialKey: SpecialKey.ENTER };
      case 0x20:
        return { specialKey: SpecialKey.SPACE };
      case 0x7f:
        return { specialKey: SpecialKey.BACKSPACE };
      case 0x09:
        return { specialKey: SpecialKey.TAB };
      case 0x03:
        return { specialKey: SpecialKey.INTERRUPT };
    }

    // printable characters
    const str = data.toString("utf8");
    if (str.length > 0) {
      return { key: str };
    }

    return {};
  }
}
