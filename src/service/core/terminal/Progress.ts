import Lifecycle from "../../../api/service/core/Lifecycle.ts";
import Terminal from "./Terminal.ts";
import { colors } from "../../../../deps.ts";

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
  private readonly writer: Deno.Writer;
  private readonly terminal: Terminal;
  private readonly bars: Map<number, Bar> = new Map();
  private intervalId: number | undefined;
  private progressIsDirty = true;
  private lastTime = 0;
  private lastBarSize = 0;
  private comColor = 0x5f8700;
  private remColor = 0x585858;
  private labColor = 0x585858;
  private valColor = 0x808080;

  public constructor(writer: Deno.Writer, lifecycle?: Lifecycle) {
    this.writer = writer;
    this.terminal = new Terminal(writer);
    lifecycle?.addShutdownListener(async () => {
      await this.hideAll();
    });
  }

  public async add(
    units: string,
    message: string,
    total: number,
    current: number,
  ): Promise<number> {
    if (this.bars.size === 0) {
      this.intervalId = setInterval(async () => {
        await this.renderBars();
      }, 100);
    }
    await this.terminal.hideCursor();

    if (total < 0) {
      total = 100;
    }
    if (current < 0) {
      current = 0;
    }
    if (current > total) {
      current = total;
    }

    this.bars.set(this.bars.size + 1, {
      name: message,
      current,
      total,
      units,
      startMillis: Date.now(),
    });
    this.progressIsDirty = true;

    return Promise.resolve(this.bars.size);
  }

  private updateRate(bar: Bar, current: number): void {
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
    if (this.bars.has(handle)) {
      const bar = this.bars.get(handle)!;
      if (current < 0) {
        current = 0;
      }
      if (current > bar.total) {
        current = bar.total;
      }
      if ((current === bar.total) && (bar.endMillis === undefined)) {
        bar.endMillis = Date.now();
      }

      this.updateRate(bar, current);

      bar.current = current;

      if (message !== undefined) {
        bar.name = message;
      }
      this.progressIsDirty = true;
    }
  }

  public async hide(handle: number): Promise<void> {
    if (this.bars.has(handle)) {
      this.bars.delete(handle);
    }
    if (this.bars.size === 0) {
      clearInterval(this.intervalId);
      delete this.intervalId;
      await this.terminal.showCursor();
    } else {
      if (this.lastBarSize > 0) {
        await this.terminal.clearUpLines(2);
      }
      this.lastBarSize -= 1;
      if (this.lastBarSize < 0) {
        this.lastBarSize = 0;
      }
    }
    this.progressIsDirty = true;
  }

  public async hideAll(): Promise<void> {
    if (this.bars.size === 0) {
      return Promise.resolve();
    }
    clearInterval(this.intervalId);
    delete this.intervalId;
    const size = this.bars.size;
    this.bars.clear();
    this.lastBarSize = 0;
    await this.terminal.clearUpLines(size * 2);
    await this.terminal.showCursor();
    this.progressIsDirty = true;
  }

  public async pause(): Promise<void> {
    if (this.bars.size === 0) {
      return Promise.resolve();
    }
    clearInterval(this.intervalId);
    delete this.intervalId;
    await this.terminal.clearUpLines(this.bars.size * 2);
    this.lastBarSize = 0;
  }

  public resume(): void {
    if ((this.bars.size === 0) || (this.intervalId !== undefined)) {
      return;
    }
    this.intervalId = setInterval(async () => {
      await this.renderBars();
    }, 100);
  }

  private async renderBars(): Promise<void> {
    const now = Date.now();

    // force re-draw after one second to update eta
    if ((now - this.lastTime >= 1000) && !this.progressIsDirty) {
      this.bars.forEach((bar) => this.updateRate(bar, bar.current));
      this.progressIsDirty = true;
    }

    // don't re-draw if we don't need to
    if ((this.bars.size === 0) || !this.progressIsDirty) {
      return;
    }
    this.lastTime = now;

    const consoleWidth = Deno.consoleSize().columns;
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
    this.bars.forEach((bar) => {
      const name = `${colors.rgb24(bar.name, this.valColor)}${
        colors.rgb24(":", this.labColor)
      }`;
      const prefix = `${colors.rgb24("[", this.labColor)}`;
      const percent = colors.rgb24(
        ((bar.current / bar.total) * 100).toFixed(2),
        this.valColor,
      ) + colors.rgb24("%,", this.labColor);

      const rate = `${
        colors.rgb24(
          (bar.rate === undefined) ? "-" : bar.rate.toFixed(2) + "",
          this.valColor,
        )
      }`;

      let suffix = `${colors.rgb24("]", this.labColor)} ${percent} `;
      if (bar.current === bar.total) {
        const taken = this.formatTime(bar.endMillis! - bar.startMillis!);
        suffix += `${colors.rgb24(bar.total + "", this.valColor)}${
          colors.rgb24(bar.units + ", rate:", this.labColor)
        } ${rate}${
          colors.rgb24(bar.units + "/s, time taken:", this.labColor)
        } ${taken}`;
      } else {
        const remaining = ((bar.rate === undefined) || (bar.rate === 0))
          ? "-"
          : this.formatTime(((bar.total - bar.current) / bar.rate) * 1000);
        suffix += `${colors.rgb24(bar.current + "", this.valColor)}${
          colors.rgb24("/", this.labColor)
        }${colors.rgb24(bar.total + "", this.valColor)}${
          colors.rgb24(bar.units + ", rate:", this.labColor)
        } ${rate}${
          colors.rgb24(bar.units + "/s, time remaining:", this.labColor)
        } ${remaining}`;
      }
      let available = consoleWidth - colors.stripColor(prefix).length -
        colors.stripColor(suffix).length;
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
      const complete = colors.rgb24("=".repeat(completeLength), this.comColor);
      const remaining = colors.rgb24(
        "-".repeat(totalLength - completeLength),
        this.remColor,
      );

      lines.push(barInfo.name);
      lines.push(barInfo.prefix + complete + remaining + barInfo.suffix);
    });

    await this.terminal.clearUpLines(this.lastBarSize * 2);
    await this.terminal.write(lines.join("\n") + "\n");
    this.lastBarSize = this.bars.size;
    this.progressIsDirty = false;
  }

  set completeColor(color: number) {
    this.comColor = color;
  }

  set remainingColor(color: number) {
    this.remColor = color;
  }

  set labelColor(color: number) {
    this.labColor = color;
  }

  set valueColor(color: number) {
    this.valColor = color;
  }

  private formatTime(millis: number): string {
    let sec = millis / 1000;
    if (sec < 60) {
      return `${colors.rgb24(sec.toFixed(0), this.valColor)}${
        colors.rgb24("s", this.labColor)
      }`;
    }
    let min = Math.floor(sec / 60);
    sec %= 60;
    if (min < 60) {
      return `${colors.rgb24(min.toFixed(0), this.valColor)}${
        colors.rgb24("m", this.labColor)
      } ${colors.rgb24(sec.toFixed(0), this.valColor)}${
        colors.rgb24("s", this.labColor)
      }`;
    }
    let hour = Math.floor(min / 60);
    min %= 60;
    if (hour < 24) {
      return `${colors.rgb24(hour.toFixed(0), this.valColor)}${
        colors.rgb24("h", this.labColor)
      } ${colors.rgb24(min.toFixed(0), this.valColor)}${
        colors.rgb24("m", this.labColor)
      } ${colors.rgb24(sec.toFixed(0), this.valColor)}${
        colors.rgb24("s", this.labColor)
      }`;
    }
    const day = Math.floor(hour / 24);
    hour %= 24;
    return `${colors.rgb24(day.toFixed(0), this.valColor)}${
      colors.rgb24("d", this.labColor)
    } ${colors.rgb24(hour.toFixed(0), this.valColor)}${
      colors.rgb24("h", this.labColor)
    } ${colors.rgb24(min.toFixed(0), this.valColor)}${
      colors.rgb24("m", this.labColor)
    } ${colors.rgb24(sec.toFixed(0), this.valColor)}${
      colors.rgb24("s", this.labColor)
    }`;
  }
}
