import Styler from "./Styler.ts";
import type Terminal from "./Terminal.ts";

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
  readonly #terminal: Terminal;
  readonly #styler: Styler;
  readonly #bars: Map<number, Bar> = new Map();
  #timer: Timer | undefined;
  #isDirty = false;
  #currentRenderedBarCount = 0;
  #lastRenderTime = 0;
  #comColor = 0x5f8700;
  #remColor = 0x585858;
  #labColor = 0x585858;
  #valColor = 0x808080;

  public constructor(terminal: Terminal, styler: Styler) {
    this.#terminal = terminal;
    this.#styler = styler;
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
    if (this.#timer === undefined) {
      this.#timer = setInterval(async () => {
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
    if (this.#timer === undefined) {
      return;
    }

    this.#isDirty = false;

    // stop rendering timer
    clearInterval(this.#timer);
    this.#timer = undefined;

    // clear the previously rendered bars
    await this.#terminal.clearUpLines(this.#currentRenderedBarCount * 2);

    this.#currentRenderedBarCount = 0;

    // restore the cursor
    await this.#terminal.showCursor();
  }

  public resume(): void {
    // don't resume if nothing to render
    if (this.#bars.size === 0) {
      return;
    }

    // force render on next timeout
    this.#isDirty = true;

    // start rendering timer
    if (this.#timer === undefined) {
      this.#timer = setInterval(async () => {
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

    const consoleWidth = this.#terminal.columns();
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
      const name = `${this.#styler.colorText(bar.name, this.#valColor)}${
        this.#styler.colorText(":", this.#labColor)
      }`;
      const prefix = `${this.#styler.colorText("[", this.#labColor)}`;
      let visibleWidth = 1;
      const percentString = ((bar.current / bar.total) * 100).toFixed(2);
      const percent = this.#styler.colorText(
        percentString,
        this.#valColor,
      ) + this.#styler.colorText("%,", this.#labColor);
      visibleWidth += percentString.length + 1;

      const rate = `${
        this.#styler.colorText(
          (bar.rate === undefined) ? "-" : bar.rate.toFixed(2) + "",
          this.#valColor,
        )
      }`;

      let suffix = `${this.#styler.colorText("]", this.#labColor)} ${percent} `;
      visibleWidth += 3;
      if (bar.current === bar.total) {
        const taken = this.#formatTime(bar.endMillis! - bar.startMillis!);
        const totalString = bar.total + "";
        suffix += `${this.#styler.colorText(totalString, this.#valColor)}${
          this.#styler.colorText(bar.units + ", rate:", this.#labColor)
        } ${rate}${
          this.#styler.colorText(
            bar.units + "/s, time taken:",
            this.#labColor,
          )
        } ${taken}`;
        visibleWidth + totalString.length + bar.units.length + 7 + 1 +
          rate.length + bar.units.length + 15 + 1 + taken.length;
      } else {
        const remaining = ((bar.rate === undefined) || (bar.rate === 0))
          ? "-"
          : this.#formatTime(((bar.total - bar.current) / bar.rate) * 1000);
        const currentString = bar.current + "";
        const totalString = bar.total + "";
        suffix += `${this.#styler.colorText(currentString, this.#valColor)}${
          this.#styler.colorText("/", this.#labColor)
        }${this.#styler.colorText(totalString, this.#valColor)}${
          this.#styler.colorText(bar.units + ", rate:", this.#labColor)
        } ${rate}${
          this.#styler.colorText(
            bar.units + "/s, time remaining:",
            this.#labColor,
          )
        } ${remaining}`;
        visibleWidth + currentString.length + 1 + totalString.length +
          bar.units.length + 7 + 1 + rate.length + bar.units.length + 19 + 1 +
          remaining.length;
      }
      let available = consoleWidth - visibleWidth;
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
      const complete = this.#styler.colorText(
        "=".repeat(completeLength),
        this.#comColor,
      );
      const remaining = this.#styler.colorText(
        "-".repeat(totalLength - completeLength),
        this.#remColor,
      );

      lines.push(barInfo.name);
      lines.push(barInfo.prefix + complete + remaining + barInfo.suffix);
    });

    // hide the cursor before rendering
    await this.#terminal.hideCursor();

    // clear the previously rendered bars
    await this.#terminal.clearUpLines(this.#currentRenderedBarCount * 2);

    // rendere the new bars
    await this.#terminal.write(lines.join("\n") + "\n");

    // save count rendered bars so we can clear on the next render cycle
    this.#currentRenderedBarCount = barInfo.length;

    // show the cursor if there are no bars or the timer is not running
    if (this.#bars.size === 0 || this.#timer === undefined) {
      await this.#terminal.showCursor();
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
      return `${this.#styler.colorText(sec.toFixed(0), this.#valColor)}${
        this.#styler.colorText("s", this.#labColor)
      }`;
    }
    let min = Math.floor(sec / 60);
    sec %= 60;
    if (min < 60) {
      return `${this.#styler.colorText(min.toFixed(0), this.#valColor)}${
        this.#styler.colorText("m", this.#labColor)
      } ${this.#styler.colorText(sec.toFixed(0), this.#valColor)}${
        this.#styler.colorText("s", this.#labColor)
      }`;
    }
    let hour = Math.floor(min / 60);
    min %= 60;
    if (hour < 24) {
      return `${this.#styler.colorText(hour.toFixed(0), this.#valColor)}${
        this.#styler.colorText("h", this.#labColor)
      } ${this.#styler.colorText(min.toFixed(0), this.#valColor)}${
        this.#styler.colorText("m", this.#labColor)
      } ${this.#styler.colorText(sec.toFixed(0), this.#valColor)}${
        this.#styler.colorText("s", this.#labColor)
      }`;
    }
    const day = Math.floor(hour / 24);
    hour %= 24;
    return `${this.#styler.colorText(day.toFixed(0), this.#valColor)}${
      this.#styler.colorText("d", this.#labColor)
    } ${this.#styler.colorText(hour.toFixed(0), this.#valColor)}${
      this.#styler.colorText("h", this.#labColor)
    } ${this.#styler.colorText(min.toFixed(0), this.#valColor)}${
      this.#styler.colorText("m", this.#labColor)
    } ${this.#styler.colorText(sec.toFixed(0), this.#valColor)}${
      this.#styler.colorText("s", this.#labColor)
    }`;
  }
}
