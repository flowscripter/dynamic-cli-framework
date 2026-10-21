export enum SpecialKey {
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3,
  ENTER = 4,
  SPACE = 5,
  BACKSPACE = 6,
  ESCAPE = 7,
  TAB = 8,
  INTERRUPT = 9,
}

export interface KeyEvent {
  readonly key?: string;
  readonly specialKey?: SpecialKey;
}

export default interface KeyReader {
  enableRawMode(): void;
  disableRawMode(): void;
  readKey(): Promise<KeyEvent>;
  /**
   * Read raw input until `isComplete` returns `true` for the accumulated input or `timeoutMs` elapses.
   * Raw mode and paused state are restored afterwards.
   *
   * @returns the accumulated input.
   */
  readRaw(isComplete: (received: string) => boolean, timeoutMs: number): Promise<string>;
}
