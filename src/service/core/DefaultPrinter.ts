import Printer, { Icon, Level } from "../../api/service/core/Printer.ts";
import { default as Spinner } from "./util/Spinner.ts";
import { colors, conversions } from "../../../deps.ts";

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

export default class DefaultPrinter implements Printer {
  private readonly writer: Deno.Writer;
  private isDarkMode = true;
  private threshold = Level.INFO;
  private iconDefinitions: Array<string> = [];
  private spinner: Spinner;
  private theme: Array<number> = [];

  private async log(
    level: number,
    message: string,
    icon?: Icon,
  ): Promise<void> {
    if (this.threshold > level) {
      return;
    }
    await this.spinner.hide();
    await conversions.writeAll(
      this.writer,
      new TextEncoder().encode(
        `${icon ? `${this.iconDefinitions[icon]} ` : ""}${message}`,
      ),
    );
  }

  public constructor(writer: Deno.Writer) {
    this.writer = writer;
    this.spinner = new Spinner(writer);
    this.darkMode = true;
    this.theme[Color.YELLOW] = 0xaf8700;
    this.theme[Color.ORANGE] = 0xd75f00;
    this.theme[Color.RED] = 0xd70000;
    this.theme[Color.MAGENTA] = 0xaf005f;
    this.theme[Color.VIOLET] = 0x5f5faf;
    this.theme[Color.BLUE] = 0x0087ff;
    this.theme[Color.CYAN] = 0x00afaf;
    this.theme[Color.GREEN] = 0x5f8700;
    this.iconDefinitions = [
      this.green("✔"),
      this.red("✖"),
      this.yellow("‼"),
      this.blue("ℹ"),
    ];
  }

  set colorEnabled(enabled: boolean) {
    colors.setColorEnabled(enabled);
  }

  get colorEnabled(): boolean {
    return colors.getColorEnabled();
  }

  set darkMode(isDarkMode: boolean) {
    this.isDarkMode = isDarkMode;
    if (isDarkMode) {
      this.theme[Color.PRIMARY] = 0x808080;
      this.theme[Color.SECONDARY] = 0x585858;
      this.theme[Color.EMPHASISED] = 0x8a8a8a;
      this.theme[Color.SELECTED] = 0x262626;
    } else {
      this.theme[Color.PRIMARY] = 0x626262;
      this.theme[Color.SECONDARY] = 0x8a8a8a;
      this.theme[Color.EMPHASISED] = 0x585858;
      this.theme[Color.SELECTED] = 0xe4e4e4;
    }
    this.spinner.spinnerColor = this.theme[Color.EMPHASISED];
    this.spinner.messageColor = this.theme[Color.PRIMARY];
  }

  get darkMode(): boolean {
    return this.isDarkMode;
  }

  get writable(): WritableStream {
    return conversions.writableStreamFromWriter(this.writer);
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

  public async showSpinner(message?: string): Promise<void> {
    await this.spinner.show(message);
  }

  public async hideSpinner(): Promise<void> {
    await this.spinner.hide();
  }

  public setLevel(level: Level): void {
    this.threshold = level;
  }
}
