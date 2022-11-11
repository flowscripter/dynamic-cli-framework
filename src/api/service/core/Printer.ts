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
 * Interface allowing a {@link Command} to output user messages.
 */
export default interface Printer {
  /**
   * Disable or enable color output for messages.
   */
  colorEnabled: boolean;

  /**
   * Enable or disable dark mode. Default is enabled i.e. `true`.
   */
  darkMode: boolean;

  /**
   * The WritableStream used for output. Can be accessed directly for output of binary data etc.
   */
  writable: WritableStream;

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
   * Return the provided message so that it the foreground is green.
   * Has no effect if {@link colorEnabled} is `false`.
   */
  green(message: string): string;

  /**
   * Print a {@link DEBUG} level message.
   * Will be displayed as secondary content if {@link colorEnabled} is `true`.
   *
   * @param message the message to output.
   * @param icon optional icon to display with the message.
   */
  debug(message: string, icon?: Icon): Promise<void>;

  /**
   * Print an {@link INFO} level message.
   * Will be displayed as primary content if {@link colorEnabled} is `true`.
   *
   * @param message the message to output.
   * @param icon optional icon to display with the message.
   */
  info(message: string, icon?: Icon): Promise<void>;

  /**
   * Print a {@link WARN} level message.
   * Will be displayed as yellow content if {@link colorEnabled} is `true`.
   *
   * @param message the message to output.
   * @param icon optional icon to display with the message.
   */
  warn(message: string, icon?: Icon): Promise<void>;

  /**
   * Print an {@link ERROR} level message.
   * Will be displayed as red content if {@link colorEnabled} is `true`.
   *
   * @param message the message to output.
   * @param icon optional icon to display with the message.
   */
  error(message: string, icon?: Icon): Promise<void>;

  /**
   * Display the spinner.
   *
   * The spinner will be displayed as emphasised content and the message will
   * be displayed as primary content if {@link colorEnabled} is `true`.
   *
   *  NOTE: The spinner and message will be displayed at {@link INFO} level.
   *
   * NOTE: If the spinner is already displayed the message will be updated to that specified.
   *
   * @param message the message to output after the spinner.
   */
  showSpinner(message: string): Promise<void>;

  /**
   * Hide the spinner.
   *
   * NOTE: Any other log method will also clear the spinner.
   */
  hideSpinner(): Promise<void>;

  /**
   * Set the output level for the printer.
   *
   * Default level is {@link INFO}.
   *
   * @param level any message below this level will be filtered from output,
   */
  setLevel(level: Level): void;
}
