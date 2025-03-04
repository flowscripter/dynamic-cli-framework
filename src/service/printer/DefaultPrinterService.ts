import { default as Spinner } from "./terminal/Spinner.ts";
import { default as Progress } from "./terminal/Progress.ts";
import type PrinterService from "../../api/service/core/PrinterService.ts";
import { type Icon, Level } from "../../api/service/core/PrinterService.ts";
import Terminal from "./terminal/Terminal.ts";
import { Color } from "./terminal/Color.ts";
import { getDarkModeTheme, getLightModeTheme } from "./terminal/Theme.ts";
import { WritableStream } from "node:stream/web";
import Styler from "./terminal/Styler.ts";

export default class DefaultPrinterService implements PrinterService {
  readonly stdoutWritable: WritableStream;
  readonly stderrWritable: WritableStream;
  #stdoutIsColor: boolean;
  #stderrTerminal: Terminal;
  #styler: Styler;
  #isDarkMode = true;
  #threshold = Level.INFO;
  #iconDefinitions: Array<string> = [];
  #theme: Array<number> = [];
  #encoder = new TextEncoder();
  #spinner: Spinner;
  #progress: Progress;

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
    await this.#stderrTerminal.write(
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
    stdoutIsColor: boolean,
    stderrIsColor: boolean,
    stderrTerminal: Terminal,
    styler: Styler,
  ) {
    this.stdoutWritable = stdoutWritableStream;
    this.stderrWritable = stderrWritableStream;
    this.#stdoutIsColor = stdoutIsColor;
    this.#stderrTerminal = stderrTerminal;
    this.#styler = styler;
    this.#styler.colorEnabled = stderrIsColor;
    this.#spinner = new Spinner(this.#stderrTerminal, this.#styler);
    this.#progress = new Progress(this.#stderrTerminal, this.#styler);
    this.darkMode = false;
    this.#iconDefinitions = [
      this.green("✔"),
      this.red("✖"),
      this.yellow("‼"),
      this.blue("ℹ"),
    ];
  }

  set colorEnabled(enabled: boolean) {
    this.#styler.colorEnabled = enabled;
    this.#stdoutIsColor = enabled;
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
    return this.#styler.colorEnabled;
  }

  set darkMode(isDarkMode: boolean) {
    this.#isDarkMode = isDarkMode;
    if (isDarkMode) {
      this.#theme = getDarkModeTheme();
    } else {
      this.#theme = getLightModeTheme();
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
    return this.#styler.colorText(message, this.#theme[Color.PRIMARY]);
  }

  public secondary(message: string): string {
    return this.#styler.colorText(message, this.#theme[Color.SECONDARY]);
  }

  public emphasised(message: string): string {
    return this.#styler.colorText(message, this.#theme[Color.EMPHASISED]);
  }

  public selected(message: string): string {
    return this.#styler.colorText(message, this.#theme[Color.SELECTED]);
  }

  public italic(message: string): string {
    return this.#styler.italicText(message);
  }

  public yellow(message: string): string {
    return this.#styler.colorText(message, this.#theme[Color.YELLOW]);
  }

  public orange(message: string): string {
    return this.#styler.colorText(message, this.#theme[Color.ORANGE]);
  }

  public red(message: string): string {
    return this.#styler.colorText(message, this.#theme[Color.RED]);
  }

  public magenta(message: string): string {
    return this.#styler.colorText(message, this.#theme[Color.MAGENTA]);
  }

  public violet(message: string): string {
    return this.#styler.colorText(message, this.#theme[Color.VIOLET]);
  }

  public blue(message: string): string {
    return this.#styler.colorText(message, this.#theme[Color.BLUE]);
  }

  public cyan(message: string): string {
    return this.#styler.colorText(message, this.#theme[Color.CYAN]);
  }

  public green(message: string): string {
    return this.#styler.colorText(message, this.#theme[Color.GREEN]);
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
    const colorMessage = this.#stdoutIsColor ? this.primary(message) : message;

    const encoded = this.#encoder.encode(
      `${
        (icon !== undefined) ? `${this.#iconDefinitions[icon]} ` : ""
      }${colorMessage}`,
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

  public async hideAllProgressBars(): Promise<void> {
    await this.#progress.hideAll();
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
