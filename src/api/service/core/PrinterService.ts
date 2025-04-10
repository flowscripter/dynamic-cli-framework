export const PRINTER_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/printer-service";
import { WritableStream } from "node:stream/web";

/**
 * Enum of message importance level.
 */
export enum Level {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Enum of message icons.
 */
export enum Icon {
  // Will be displayed in green if {@link Printer.colorEnabled} is `true`.
  SUCCESS = 0,
  // Will be displayed in red if {@link Printer.colorEnabled} is `true`.
  FAILURE = 1,
  // Will be displayed in yellow if {@link Printer.colorEnabled} is `true`.
  ALERT = 2,
  // Will be displayed in blue if {@link Printer.colorEnabled} is `true`.
  INFORMATION = 3,
}

/**
 * Service allowing a {@link Command} to output user messages to `stdout` and/or `stderr`.
 *
 * Output to `stdout` is via {@link print} whilst output to `stderr` is via a filtered logging mechanism
 * using {@link debug}, {@link info}, {@link warn} and {@link error}.
 */
export default interface PrinterService {
  /**
   * Disable or enable color output for messages.
   */
  colorEnabled: boolean;

  /**
   * Enable or disable dark mode. Default is disabled i.e. `false`.
   */
  darkMode: boolean;

  /**
   * The WritableStream used for `stdout`. Can be accessed directly for output of binary data etc.
   */
  stdoutWritable: WritableStream;

  /**
   * The WritableStream used for `stderr`. Can be accessed directly for output of binary data etc.
   */
  stderrWritable: WritableStream;

  /**
   * Return the provided message so that the foreground is colored as primary content. This is the default
   * calor applied. The actual color will depend on the value of {@link darkMode}.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  primary(message: string): string;

  /**
   * Return the provided message so that the foreground is colored as secondary content.
   * The actual color will depend on the value of {@link darkMode}.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  secondary(message: string): string;

  /**
   * Return the provided message so that the foreground is colored as emphasised content.
   * The actual color will depend on the value of {@link darkMode}.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  emphasised(message: string): string;

  /**
   * Return the provided message so that the background is colored as selected content.
   * The actual color will depend on the value of {@link darkMode}.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  selected(message: string): string;

  /**
   * Return the provided message so that the text is displayed in italic.
   */
  italic(message: string): string;

  /**
   * Return the provided message so that the foreground is yellow.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  yellow(message: string): string;

  /**
   * Return the provided message so that the foreground is orange.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  orange(message: string): string;

  /**
   * Return the provided message so that the foreground is red.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  red(message: string): string;

  /**
   * Return the provided message so that the foreground is magenta.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  magenta(message: string): string;

  /**
   * Return the provided message so that the foreground is violet.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  violet(message: string): string;

  /**
   * Return the provided message so that the foreground is blue.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  blue(message: string): string;

  /**
   * Return the provided message so that the foreground is cyan.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  cyan(message: string): string;

  /**
   * Return the provided message so that the foreground is green.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  green(message: string): string;

  /**
   * Return the provided message so that the foreground is the specified color.
   * Has no effect if {@link colorEnabled} is `false`.
   *
   * @param message the message to color.
   * @param hexFormattedColor the color to use. This should be a valid hex formatted string e.g. "0xrrggbb".
   */
  color(message: string, hexFormattedColor: string): string;

  /**
   * Print a message on `stdout`.
   * Will be displayed as primary content if {@link colorEnabled} is `true`.
   *
   * @param message the message to output.
   * @param icon optional icon to display with the message.
   */
  print(message: string, icon?: Icon): Promise<void>;

  /**
   * Print a {@link DEBUG} level message on `stderr`.
   * Will be displayed as secondary content if {@link colorEnabled} is `true`.
   *
   * @param message the message to output.
   * @param icon optional icon to display with the message.
   */
  debug(message: string, icon?: Icon): Promise<void>;

  /**
   * Print an {@link INFO} level message on `stderr`.
   * Will be displayed as primary content if {@link colorEnabled} is `true`.
   *
   * @param message the message to output.
   * @param icon optional icon to display with the message.
   */
  info(message: string, icon?: Icon): Promise<void>;

  /**
   * Print a {@link WARN} level message on `stderr`.
   * Will be displayed as yellow content if {@link colorEnabled} is `true`.
   *
   * @param message the message to output.
   * @param icon optional icon to display with the message.
   */
  warn(message: string, icon?: Icon): Promise<void>;

  /**
   * Print an {@link ERROR} level message on `stderr`.
   * Will be displayed as red content if {@link colorEnabled} is `true`.
   *
   * @param message the message to output.
   * @param icon optional icon to display with the message.
   */
  error(message: string, icon?: Icon): Promise<void>;

  /**
   * Set the output threshold {@link Level} for `stderr`.
   *
   * Default level is {@link INFO}.
   *
   * @param level any message below this level will be filtered from output,
   */
  setLevel(level: Level): void;

  /**
   * Get the output threshold {@link Level} for `stderr`.
   */
  getLevel(): Level;

  /**
   * Display the spinner on `stderr`.
   *
   * The spinner will be displayed as emphasised content and the message will
   * be displayed as primary content if {@link colorEnabled} is `true`.
   *
   * NOTE: The spinner and message will be displayed at {@link INFO} level.
   *
   * NOTE: If the spinner is already displayed the message will be updated to that specified.
   *
   * NOTE: If any progress bars are currently displayed they will be hidden.
   *
   * @param message the message to output after the spinner.
   */
  showSpinner(message: string): Promise<void>;

  /**
   * Hide the spinner.
   *
   * NOTE: Showing a progress bar will also hide the spinner.
   */
  hideSpinner(): Promise<void>;

  /**
   * Display a progress bar on `stderr`.
   *
   * The progress will be displayed in green if {@link colorEnabled} is `true`.
   *
   * NOTE: The progress bar and message will be displayed at {@link INFO} level.
   *
   * NOTE: If the spinner is currently displayed it will be hidden.
   *
   * @param units the units to display for progress indication e.g. 'MB' or 'Kb'.
   * @param message an optional message for the progress bar.
   * @param total the total value which equates to 100% complete, defaults to `100`.
   * @param current the current value which is a portion of the total value, defaults to `0`.
   *
   * @return a handle to use when invoking {@link updateProgressBar}.
   */
  showProgressBar(
    units: string,
    message?: string,
    total?: number,
    current?: number,
  ): Promise<number>;

  /**
   * Hides a specified progress bar.
   *
   * NOTE: Showing the spinner will also hide ALL progress bars.
   *
   * @param handle the handle referring to the progress bar to be hidden.
   */
  hideProgressBar(handle: number): Promise<void>;

  /**
   * Hides all progress bars.
   *
   * NOTE: Showing the spinner will also hide ALL progress bars.
   */
  hideAllProgressBars(): Promise<void>;

  /**
   * Update a specific progress bar.
   *
   * @param handle the handle referring to the progress bar to be updated.
   * @param current the current value to set on the progress bar.
   * @param message an optional message to set on the progress bar, if not specified the initially specified message will be displayed.
   */
  updateProgressBar(handle: number, current: number, message?: string): void;
}
