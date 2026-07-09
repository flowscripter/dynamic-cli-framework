import type Styler from "../../../terminal/Styler.ts";

interface Level {
  color: number;
  opened: boolean;
}

const COLUMN = "│ ";
const BRANCH = "├";
const OPENER = "┐ ";

export default class Quote {
  readonly #styler: Styler;
  readonly #levels: Level[] = [];

  public constructor(styler: Styler) {
    this.#styler = styler;
  }

  public get isActive(): boolean {
    return this.#levels.length > 0;
  }

  public push(color: number): void {
    this.#levels.push({ color, opened: false });
  }

  public pop(): void {
    if (this.#levels.length === 0) {
      throw new Error("endQuote() called without a matching startQuote()");
    }
    this.#levels.pop();
  }

  #prefixLine(): string {
    const count = this.#levels.length;
    const newest = this.#levels[count - 1]!;

    if (newest.opened) {
      return this.#levels.map((level) => this.#styler.colorText(COLUMN, level.color)).join("");
    }

    newest.opened = true;
    let prefix = "";
    for (let i = 0; i < count - 2; i++) {
      const level = this.#levels[i]!;
      prefix += this.#styler.colorText(COLUMN, level.color);
    }
    if (count >= 2) {
      const branchLevel = this.#levels[count - 2]!;
      prefix += this.#styler.colorText(BRANCH, branchLevel.color);
    }
    prefix += this.#styler.colorText(OPENER, newest.color);
    return prefix;
  }

  public prefixLines(message: string): string {
    if (!this.isActive) {
      return message;
    }
    const endsWithNewline = message.endsWith("\n");
    const raw = endsWithNewline ? message.slice(0, -1) : message;
    const lines = raw.split("\n").map((line) => this.#prefixLine() + line);
    return lines.join("\n") + (endsWithNewline ? "\n" : "");
  }
}
