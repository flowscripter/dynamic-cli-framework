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
    // colorText()/italicText() etc. wrap an entire passed-in string - including a trailing
    // "\n", when the caller's message already ends with one - with a reset sequence appended
    // *after* that newline (e.g. "foo\n" -> "<color>foo\n<reset>"). Naively checking
    // endsWith("\n") on such styled text is always false, and splitting on "\n" then treats the
    // trailing reset sequence as a spurious extra line, which gets its own quote prefix -
    // rendering as if two quote levels were active for a single actual line (see #150). Every
    // line gets re-colored below regardless, so strip all existing ANSI upfront rather than
    // trying to preserve and restore it.
    const body = Bun.stripANSI(message);
    const endsWithNewline = body.endsWith("\n");
    const raw = endsWithNewline ? body.slice(0, -1) : body;
    const color = this.#levels[this.#levels.length - 1]!.color;
    const lines = raw
      .split("\n")
      .map((line) => this.#prefixLine() + this.#styler.colorText(line, color));
    return lines.join("\n") + (endsWithNewline ? "\n" : "");
  }
}
