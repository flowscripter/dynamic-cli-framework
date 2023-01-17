import Printer, {
  AsciiBannerFont,
  Icon,
  Level,
} from "../../api/service/core/Printer.ts";
import { default as Spinner } from "./terminal/Spinner.ts";
import { default as Progress } from "./terminal/Progress.ts";
import {
  banner_font,
  big_font,
  colors,
  conversions,
  figlet_factory,
  figlet_serializer,
  slant_font,
  small_font,
  smslant_font,
  standard_font,
  thin_font,
} from "../../../deps.ts";
import Lifecycle from "../../api/service/core/Lifecycle.ts";
import { ITALIC_END, ITALIC_START } from "./terminal/Ansi.ts";

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
// TODO: move all core services into sub-folders and include provided commands

export default class DefaultPrinter implements Printer {
  private readonly stdoutWriter: Deno.Writer;
  private readonly stderrWriter: Deno.Writer;
  private isDarkMode = true;
  private threshold = Level.INFO;
  private iconDefinitions: Array<string> = [];
  private spinner: Spinner;
  private progress: Progress;
  private theme: Array<number> = [];

  private async log(
    level: number,
    message: string,
    icon?: Icon,
  ): Promise<void> {
    if (this.threshold > level) {
      return;
    }
    await this.spinner.pause();
    await this.progress.pause();
    await conversions.writeAll(
      this.stderrWriter,
      new TextEncoder().encode(
        `${icon ? `${this.iconDefinitions[icon]} ` : ""}${message}`,
      ),
    );
    this.spinner.resume();
    await this.progress.resume();
  }

  public constructor(
    stdoutWriter: Deno.Writer,
    stderrWriter: Deno.Writer,
    lifecycle?: Lifecycle,
  ) {
    this.stdoutWriter = stdoutWriter;
    this.stderrWriter = stderrWriter;
    this.spinner = new Spinner(stderrWriter, lifecycle);
    this.progress = new Progress(stderrWriter, lifecycle);
    this.theme[Color.YELLOW] = 0xb58900;
    this.theme[Color.ORANGE] = 0xcb4b16;
    this.theme[Color.RED] = 0xdc322f;
    this.theme[Color.MAGENTA] = 0xd33682;
    this.theme[Color.VIOLET] = 0x6c71c4;
    this.theme[Color.BLUE] = 0x268bd2;
    this.theme[Color.CYAN] = 0x2aa198;
    this.theme[Color.GREEN] = 0x859900;
    this.iconDefinitions = [
      this.green("✔"),
      this.red("✖"),
      this.yellow("‼"),
      this.blue("ℹ"),
    ];
    this.darkMode = false;
  }

  set colorEnabled(enabled: boolean) {
    colors.setColorEnabled(enabled);
    if (enabled) {
      this.iconDefinitions = [
        this.green("✔"),
        this.red("✖"),
        this.yellow("‼"),
        this.blue("ℹ"),
      ];
    } else {
      this.iconDefinitions = [
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
    this.isDarkMode = isDarkMode;
    if (isDarkMode) {
      this.theme[Color.PRIMARY] = 0x839496;
      this.theme[Color.SECONDARY] = 0x586e75;
      this.theme[Color.EMPHASISED] = 0x93a1a1;
      this.theme[Color.SELECTED] = 0x073642;
    } else {
      this.theme[Color.PRIMARY] = 0x657b83;
      this.theme[Color.SECONDARY] = 0x93a1a1;
      this.theme[Color.EMPHASISED] = 0x586e75;
      this.theme[Color.SELECTED] = 0xeee8d5;
    }
    this.spinner.spinnerColor = this.theme[Color.EMPHASISED];
    this.spinner.messageColor = this.theme[Color.PRIMARY];
    this.progress.completeColor = this.theme[Color.GREEN];
    this.progress.remainingColor = this.theme[Color.SECONDARY];
    this.progress.labelColor = this.theme[Color.SECONDARY];
    this.progress.valueColor = this.theme[Color.PRIMARY];
  }

  get darkMode(): boolean {
    return this.isDarkMode;
  }

  get stdout(): WritableStream {
    return conversions.writableStreamFromWriter(this.stdoutWriter);
  }

  get stderr(): WritableStream {
    return conversions.writableStreamFromWriter(this.stderrWriter);
  }

  public primary(message: string): string {
    return colors.rgb24(message, this.theme[Color.PRIMARY]);
  }

  public secondary(message: string): string {
    return colors.rgb24(message, this.theme[Color.SECONDARY]);
  }

  public emphasised(message: string): string {
    return colors.rgb24(message, this.theme[Color.EMPHASISED]);
  }

  public selected(message: string): string {
    return colors.bgRgb24(message, this.theme[Color.SELECTED]);
  }

  public italic(message: string): string {
    return ITALIC_START + message + ITALIC_END;
  }

  public yellow(message: string): string {
    return colors.rgb24(message, this.theme[Color.YELLOW]);
  }

  public orange(message: string): string {
    return colors.rgb24(message, this.theme[Color.ORANGE]);
  }

  public red(message: string): string {
    return colors.rgb24(message, this.theme[Color.RED]);
  }

  public magenta(message: string): string {
    return colors.rgb24(message, this.theme[Color.MAGENTA]);
  }

  public violet(message: string): string {
    return colors.rgb24(message, this.theme[Color.VIOLET]);
  }

  public blue(message: string): string {
    return colors.rgb24(message, this.theme[Color.BLUE]);
  }

  public cyan(message: string): string {
    return colors.rgb24(message, this.theme[Color.CYAN]);
  }

  public green(message: string): string {
    return colors.rgb24(message, this.theme[Color.GREEN]);
  }

  public async asciiBanner(
    message: string,
    font = AsciiBannerFont.STANDARD,
  ): Promise<string> {
    let fontDefinition;
    switch (font) {
      case AsciiBannerFont.BANNER:
        fontDefinition = banner_font.font;
        break;
      case AsciiBannerFont.BIG:
        fontDefinition = big_font.font;
        break;
      case AsciiBannerFont.SLANT:
        fontDefinition = slant_font.font;
        break;
      case AsciiBannerFont.SMALL:
        fontDefinition = small_font.font;
        break;
      case AsciiBannerFont.SMALL_SLANT:
        fontDefinition = smslant_font.font;
        break;
      case AsciiBannerFont.THIN:
        fontDefinition = thin_font.font;
        break;
      default:
        fontDefinition = standard_font.font;
    }
    const dictionary = await figlet_serializer(fontDefinition);

    return await figlet_factory(message, dictionary);
  }

  public async debug(message: string, icon?: Icon): Promise<void> {
    await this.log(Level.DEBUG, this.secondary(message), icon);
  }

  public async info(message: string, icon?: Icon): Promise<void> {
    await this.log(Level.INFO, this.primary(message), icon);
  }

  public async warn(message: string, icon?: Icon): Promise<void> {
    await this.log(Level.WARN, this.yellow(message), icon);
  }

  public async error(message: string, icon?: Icon): Promise<void> {
    await this.log(Level.ERROR, this.red(message), icon);
  }

  public async print(message: string, icon?: Icon): Promise<void> {
    await conversions.writeAll(
      this.stdoutWriter,
      new TextEncoder().encode(
        `${icon ? `${this.iconDefinitions[icon]} ` : ""}${message}`,
      ),
    );
  }

  public async setLevel(level: Level): Promise<void> {
    if (this.threshold > Level.INFO) {
      await this.spinner.hide();
      await this.progress.hideAll();
    }
    this.threshold = level;
  }

  public getLevel(): Level {
    return this.threshold;
  }

  public async showSpinner(message?: string): Promise<void> {
    await this.progress.hideAll();
    if (this.threshold > Level.INFO) {
      return;
    }
    await this.spinner.show(message);
  }

  public async hideSpinner(): Promise<void> {
    await this.spinner.hide();
  }

  public async showProgressBar(
    units: string,
    message = "",
    total = 100,
    current = 0,
  ): Promise<number> {
    await this.spinner.hide();
    if (this.threshold > Level.INFO) {
      return -1;
    }

    return await this.progress.add(units, message, total, current);
  }

  public async hideProgressBar(handle: number): Promise<void> {
    await this.progress.hide(handle);
  }

  public updateProgressBar(
    handle: number,
    current: number,
    message?: string,
  ): void {
    if (this.threshold > Level.INFO) {
      return;
    }
    this.progress.update(handle, current, message);
  }
}
