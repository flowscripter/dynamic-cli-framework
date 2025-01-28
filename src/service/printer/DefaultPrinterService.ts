import { default as Spinner } from "./terminal/Spinner.ts";
import { default as Progress } from "./terminal/Progress.ts";
import * as colors from "@std/fmt/colors";
import { ITALIC_END, ITALIC_START } from "./terminal/Ansi.ts";
import type PrinterService from "../../api/service/core/PrinterService.ts";
import { type Icon, Level } from "../../api/service/core/PrinterService.ts";
import type ShutdownService from "../../api/service/core/ShutdownService.ts";
import { SHUTDOWN_SERVICE_ID } from "../../api/service/core/ShutdownService.ts";
import type Context from "../../api/Context.ts";
import Terminal from "./terminal/Terminal.ts";

enum Color {
  PRIMARY = 0,
  SECONDARY = 1,
  EMPHASISED = 2,
  SELECTED = 3,
  YELLOW = 4,
  ORANGE = 5,
  RED = 6,
  MAGENTA = 7,
  VIOLET = 8,
  BLUE = 9,
  CYAN = 10,
  GREEN = 11,
}

export default class DefaultPrinterService implements PrinterService {
  readonly stdoutWritable: WritableStream;
  readonly stderrWritable: WritableStream;
  #isDarkMode = true;
  #threshold = Level.INFO;
  #iconDefinitions: Array<string> = [];
  #theme: Array<number> = [];
  #encoder = new TextEncoder();
  #spinner: Spinner;
  #progress: Progress;
  #terminal: Terminal;

  async #log(
    level: number,
    message: string,
    icon?: Icon,
  ): Promise<void> {
    if (this.#threshold > level) {
      return;
    }
    await this.#spinner.pause();
    await this.#progress.pause();
    await this.#terminal.write(
      `${
        (icon !== undefined) ? `${this.#iconDefinitions[icon]} ` : ""
      }${message}`,
    );
    this.#spinner.resume();
    this.#progress.resume();
  }

  public constructor(
    stdoutWritableStream: WritableStream,
    stderrWritableStream: WritableStream,
  ) {
    this.stdoutWritable = stdoutWritableStream;
    this.stderrWritable = stderrWritableStream;
    this.#terminal = new Terminal(this.stderrWritable);
    this.#spinner = new Spinner(this.#terminal);
    this.#progress = new Progress(this.#terminal);
    this.#theme[Color.YELLOW] = 0xb58900;
    this.#theme[Color.ORANGE] = 0xcb4b16;
    this.#theme[Color.RED] = 0xdc322f;
    this.#theme[Color.MAGENTA] = 0xd33682;
    this.#theme[Color.VIOLET] = 0x6c71c4;
    this.#theme[Color.BLUE] = 0x268bd2;
    this.#theme[Color.CYAN] = 0x2aa198;
    this.#theme[Color.GREEN] = 0x859900;
    this.#iconDefinitions = [
      this.green("✔"),
      this.red("✖"),
      this.yellow("‼"),
      this.blue("ℹ"),
    ];
    this.darkMode = false;
  }

  init(context: Context) {
    const shutdownService = context.getServiceById(
      SHUTDOWN_SERVICE_ID,
    ) as ShutdownService;
    shutdownService.addShutdownListener(async () => {
      await this.#spinner.hide();
    });
    shutdownService.addShutdownListener(async () => {
      await this.#progress.hideAll();
    });
  }

  set colorEnabled(enabled: boolean) {
    colors.setColorEnabled(enabled);
    if (enabled) {
      this.#iconDefinitions = [
        this.green("✔"),
        this.red("✖"),
        this.yellow("‼"),
        this.blue("ℹ"),
      ];
    } else {
      this.#iconDefinitions = [
        "✔",
        "✖",
        "‼",
        "ℹ",
      ];
    }
  }

  get colorEnabled(): boolean {
    return colors.getColorEnabled();
  }

  set darkMode(isDarkMode: boolean) {
    this.#isDarkMode = isDarkMode;
    if (isDarkMode) {
      this.#theme[Color.PRIMARY] = 0x839496;
      this.#theme[Color.SECONDARY] = 0x586e75;
      this.#theme[Color.EMPHASISED] = 0x93a1a1;
      this.#theme[Color.SELECTED] = 0x073642;
    } else {
      this.#theme[Color.PRIMARY] = 0x657b83;
      this.#theme[Color.SECONDARY] = 0x93a1a1;
      this.#theme[Color.EMPHASISED] = 0x586e75;
      this.#theme[Color.SELECTED] = 0xeee8d5;
    }
    this.#spinner.spinnerColor = this.#theme[Color.EMPHASISED];
    this.#spinner.messageColor = this.#theme[Color.PRIMARY];
    this.#progress.completeColor = this.#theme[Color.GREEN];
    this.#progress.remainingColor = this.#theme[Color.SECONDARY];
    this.#progress.labelColor = this.#theme[Color.SECONDARY];
    this.#progress.valueColor = this.#theme[Color.PRIMARY];
  }

  get darkMode(): boolean {
    return this.#isDarkMode;
  }

  public primary(message: string): string {
    return colors.rgb24(message, this.#theme[Color.PRIMARY]);
  }

  public secondary(message: string): string {
    return colors.rgb24(message, this.#theme[Color.SECONDARY]);
  }

  public emphasised(message: string): string {
    return colors.rgb24(message, this.#theme[Color.EMPHASISED]);
  }

  public selected(message: string): string {
    return colors.bgRgb24(message, this.#theme[Color.SELECTED]);
  }

  public italic(message: string): string {
    return ITALIC_START + message + ITALIC_END;
  }

  public yellow(message: string): string {
    return colors.rgb24(message, this.#theme[Color.YELLOW]);
  }

  public orange(message: string): string {
    return colors.rgb24(message, this.#theme[Color.ORANGE]);
  }

  public red(message: string): string {
    return colors.rgb24(message, this.#theme[Color.RED]);
  }

  public magenta(message: string): string {
    return colors.rgb24(message, this.#theme[Color.MAGENTA]);
  }

  public violet(message: string): string {
    return colors.rgb24(message, this.#theme[Color.VIOLET]);
  }

  public blue(message: string): string {
    return colors.rgb24(message, this.#theme[Color.BLUE]);
  }

  public cyan(message: string): string {
    return colors.rgb24(message, this.#theme[Color.CYAN]);
  }

  public green(message: string): string {
    return colors.rgb24(message, this.#theme[Color.GREEN]);
  }

  public async debug(message: string, icon?: Icon): Promise<void> {
    await this.#log(Level.DEBUG, this.secondary(message), icon);
  }

  public async info(message: string, icon?: Icon): Promise<void> {
    await this.#log(Level.INFO, this.primary(message), icon);
  }

  public async warn(message: string, icon?: Icon): Promise<void> {
    await this.#log(Level.WARN, this.yellow(message), icon);
  }

  public async error(message: string, icon?: Icon): Promise<void> {
    await this.#log(Level.ERROR, this.red(message), icon);
  }

  public async print(message: string, icon?: Icon): Promise<void> {
    await this.#spinner.pause();
    await this.#progress.pause();

    const writer = this.stdoutWritable.getWriter();
    const encoded = this.#encoder.encode(
      `${
        (icon !== undefined) ? `${this.#iconDefinitions[icon]} ` : ""
      }${message}`,
    );

    await writer.ready;
    await writer.write(encoded);

    writer.releaseLock();
    this.#spinner.resume();
    this.#progress.resume();
  }

  public async setLevel(level: Level): Promise<void> {
    if (this.#threshold > Level.INFO) {
      await this.#spinner.hide();
      await this.#progress.hideAll();
    }
    this.#threshold = level;
  }

  public getLevel(): Level {
    return this.#threshold;
  }

  public async showSpinner(message?: string): Promise<void> {
    await this.#progress.hideAll();
    if (this.#threshold > Level.INFO) {
      return;
    }
    await this.#spinner.show(message);
  }

  public async hideSpinner(): Promise<void> {
    await this.#spinner.hide();
  }

  public async showProgressBar(
    units: string,
    message = "",
    total = 100,
    current = 0,
  ): Promise<number> {
    await this.#spinner.hide();
    if (this.#threshold > Level.INFO) {
      return -1;
    }

    return this.#progress.add(units, message, total, current);
  }

  public async hideProgressBar(handle: number): Promise<void> {
    await this.#progress.hide(handle);
  }

  public updateProgressBar(
    handle: number,
    current: number,
    message?: string,
  ): void {
    if (this.#threshold > Level.INFO) {
      return;
    }
    this.#progress.update(handle, current, message);
  }
}
