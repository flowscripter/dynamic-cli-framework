import type Terminal from "./Terminal.ts";
import * as colors from "@std/fmt/colors";

const RATE_SMOOTHING_FACTOR = 0.005;

interface Bar {
  name: string;
  current: number;
  total: number;
  units: string;
  lastMillis?: number;
  startMillis?: number;
  endMillis?: number;
  rate?: number;
}

export default class Progress {
  readonly #term: Terminal;
  readonly #bars: Map<number, Bar> = new Map();
  #intervalId: number | undefined;
  #isDirty = false;
  #currentRenderedBarCount = 0;
  #lastRenderTime = 0;
  #comColor = 0x5f8700;
  #remColor = 0x585858;
  #labColor = 0x585858;
  #valColor = 0x808080;

  public constructor(terminal: Terminal) {
    this.#term = terminal;
  }

  public add(
    units: string,
    message: string,
    total: number,
    current: number,
  ): number {
    if (total < 0) {
      total = 100;
    }
    if (current < 0) {
      current = 0;
    }
    if (current > total) {
      current = total;
    }

    this.#bars.set(this.#bars.size + 1, {
      name: message,
      current,
      total,
      units,
      startMillis: Date.now(),
    });

    // force render on next timeout
    this.#isDirty = true;

    // start rendering timer
    if (this.#intervalId === undefined) {
      this.#intervalId = setInterval(async () => {
        await this.#renderBars();
      }, 100);
    }

    return this.#bars.size;
  }

  #updateRate(bar: Bar, current: number): void {
    const now = Date.now();
    if (bar.lastMillis === undefined) {
      bar.rate = ((current - bar.current) * 1000) / (now - bar.startMillis!);
    } else {
      let currentRate = ((current - bar.current) * 1000) /
        (now - bar.lastMillis!);
      if (!isFinite(currentRate)) {
        currentRate = 0;
      }
      bar.rate = (currentRate * RATE_SMOOTHING_FACTOR) +
        (bar.rate! * (1 - RATE_SMOOTHING_FACTOR));
    }
    bar.lastMillis = now;
  }

  public update(handle: number, current: number, message?: string): void {
    if (!this.#bars.has(handle)) {
      return;
    }
    const bar = this.#bars.get(handle)!;
    if (current < 0) {
      current = 0;
    }
    if (current > bar.total) {
      current = bar.total;
    }
    if ((current === bar.total) && (bar.endMillis === undefined)) {
      bar.endMillis = Date.now();
    }

    this.#updateRate(bar, current);

    bar.current = current;

    if (message !== undefined) {
      bar.name = message;
    }

    // force render on next timeout
    this.#isDirty = true;
  }

  public async hide(handle: number): Promise<void> {
    // clear specified bar
    if (this.#bars.has(handle)) {
      this.#bars.delete(handle);
    }

    // if no more bars, effectively this is a pause
    if (this.#bars.size === 0) {
      await this.pause();

      return;
    }

    // otherwise, force render on next timeout
    this.#isDirty = true;
  }

  public async hideAll(): Promise<void> {
    // clear all bars
    this.#bars.clear();

    await this.pause();
  }

  public async pause(): Promise<void> {
    if (this.#intervalId === undefined) {
      return;
    }

    this.#isDirty = false;

    // stop rendering timer
    clearInterval(this.#intervalId);
    this.#intervalId = undefined;

    // clear the previously rendered bars
    await this.#term.clearUpLines(this.#currentRenderedBarCount * 2);

    this.#currentRenderedBarCount = 0;

    // restore the cursor
    await this.#term.showCursor();
  }

  public resume(): void {
    // don't resume if nothing to render
    if (this.#bars.size === 0) {
      return;
    }

    // force render on next timeout
    this.#isDirty = true;

    // start rendering timer
    if (this.#intervalId === undefined) {
      this.#intervalId = setInterval(async () => {
        await this.#renderBars();
      }, 100);
    }
  }

  async #renderBars(): Promise<void> {
    const now = Date.now();

    // force render after one second to update newly calculated eta
    if ((now - this.#lastRenderTime >= 1000) && !this.#isDirty) {
      this.#bars.forEach((bar) => this.#updateRate(bar, bar.current));
      this.#isDirty = true;
    }

    // don't render if we don't need to
    if (!this.#isDirty) {
      return;
    }

    this.#lastRenderTime = now;

    const consoleWidth = this.#term.columns();
    const lines: Array<string> = [];

    const barInfo: Array<
      {
        name: string;
        prefix: string;
        available: number;
        suffix: string;
        bar: Bar;
      }
    > = [];

    this.#bars.forEach((bar) => {
      const name = `${colors.rgb24(bar.name, this.#valColor)}${
        colors.rgb24(":", this.#labColor)
      }`;
      const prefix = `${colors.rgb24("[", this.#labColor)}`;
      const percent = colors.rgb24(
        ((bar.current / bar.total) * 100).toFixed(2),
        this.#valColor,
      ) + colors.rgb24("%,", this.#labColor);

      const rate = `${
        colors.rgb24(
          (bar.rate === undefined) ? "-" : bar.rate.toFixed(2) + "",
          this.#valColor,
        )
      }`;

      let suffix = `${colors.rgb24("]", this.#labColor)} ${percent} `;
      if (bar.current === bar.total) {
        const taken = this.#formatTime(bar.endMillis! - bar.startMillis!);
        suffix += `${colors.rgb24(bar.total + "", this.#valColor)}${
          colors.rgb24(bar.units + ", rate:", this.#labColor)
        } ${rate}${
          colors.rgb24(bar.units + "/s, time taken:", this.#labColor)
        } ${taken}`;
      } else {
        const remaining = ((bar.rate === undefined) || (bar.rate === 0))
          ? "-"
          : this.#formatTime(((bar.total - bar.current) / bar.rate) * 1000);
        suffix += `${colors.rgb24(bar.current + "", this.#valColor)}${
          colors.rgb24("/", this.#labColor)
        }${colors.rgb24(bar.total + "", this.#valColor)}${
          colors.rgb24(bar.units + ", rate:", this.#labColor)
        } ${rate}${
          colors.rgb24(bar.units + "/s, time remaining:", this.#labColor)
        } ${remaining}`;
      }
      let available = consoleWidth - colors.stripAnsiCode(prefix).length -
        colors.stripAnsiCode(suffix).length;
      if (available < 0) {
        available = 0;
      }
      barInfo.push({
        name,
        prefix,
        available,
        suffix,
        bar,
      });
    });

    let totalLength = consoleWidth;
    barInfo.forEach((barInfo) => {
      if (barInfo.available < totalLength) {
        totalLength = barInfo.available;
      }
    });
    totalLength = Math.min(50, totalLength);

    barInfo.forEach((barInfo) => {
      const completeLength = Math.floor(
        totalLength * barInfo.bar.current / barInfo.bar.total,
      );
      const complete = colors.rgb24("=".repeat(completeLength), this.#comColor);
      const remaining = colors.rgb24(
        "-".repeat(totalLength - completeLength),
        this.#remColor,
      );

      lines.push(barInfo.name);
      lines.push(barInfo.prefix + complete + remaining + barInfo.suffix);
    });

    // hide the cursor before rendering
    await this.#term.hideCursor();

    // clear the previously rendered bars
    await this.#term.clearUpLines(this.#currentRenderedBarCount * 2);

    // rendere the new bars
    await this.#term.write(lines.join("\n") + "\n");

    // save count rendered bars so we can clear on the next render cycle
    this.#currentRenderedBarCount = barInfo.length;

    // show the cursor if there are no bars or the timer is not running
    if (this.#bars.size === 0 || this.#intervalId === undefined) {
      await this.#term.showCursor();
    }

    this.#isDirty = false;
  }

  set completeColor(color: number) {
    this.#comColor = color;
  }

  set remainingColor(color: number) {
    this.#remColor = color;
  }

  set labelColor(color: number) {
    this.#labColor = color;
  }

  set valueColor(color: number) {
    this.#valColor = color;
  }

  #formatTime(millis: number): string {
    let sec = millis / 1000;
    if (sec < 60) {
      return `${colors.rgb24(sec.toFixed(0), this.#valColor)}${
        colors.rgb24("s", this.#labColor)
      }`;
    }
    let min = Math.floor(sec / 60);
    sec %= 60;
    if (min < 60) {
      return `${colors.rgb24(min.toFixed(0), this.#valColor)}${
        colors.rgb24("m", this.#labColor)
      } ${colors.rgb24(sec.toFixed(0), this.#valColor)}${
        colors.rgb24("s", this.#labColor)
      }`;
    }
    let hour = Math.floor(min / 60);
    min %= 60;
    if (hour < 24) {
      return `${colors.rgb24(hour.toFixed(0), this.#valColor)}${
        colors.rgb24("h", this.#labColor)
      } ${colors.rgb24(min.toFixed(0), this.#valColor)}${
        colors.rgb24("m", this.#labColor)
      } ${colors.rgb24(sec.toFixed(0), this.#valColor)}${
        colors.rgb24("s", this.#labColor)
      }`;
    }
    const day = Math.floor(hour / 24);
    hour %= 24;
    return `${colors.rgb24(day.toFixed(0), this.#valColor)}${
      colors.rgb24("d", this.#labColor)
    } ${colors.rgb24(hour.toFixed(0), this.#valColor)}${
      colors.rgb24("h", this.#labColor)
    } ${colors.rgb24(min.toFixed(0), this.#valColor)}${
      colors.rgb24("m", this.#labColor)
    } ${colors.rgb24(sec.toFixed(0), this.#valColor)}${
      colors.rgb24("s", this.#labColor)
    }`;
  }
}
