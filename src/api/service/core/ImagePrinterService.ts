export const IMAGE_PRINTER_SERVICE_ID = "@flowscripter/dynamic-cli-framework/image-printer-service";

/**
 * Service for rendering images in the terminal.
 *
 * Uses the Kitty or iTerm2 graphics protocol when supported, otherwise falls back
 * to ANSI half-block character rendering. Terminal multiplexers (tmux, screen) always
 * use the ANSI fallback as they do not pass through graphics protocol escape sequences.
 */
export default interface ImagePrinterService {
  /**
   * Render an image as a string suitable for terminal output.
   *
   * @param imageBuffer the raw image data (e.g. PNG file contents).
   * @param widthPercentage the percentage of terminal width to use for rendering. Defaults to 100.
   * @param hexFormattedBackgroundColor optional background color for transparent pixels.
   *   This should be a valid hex formatted string e.g. "#rrggbb". If not specified,
   *   transparent pixels show through to the terminal background.
   */
  image(
    imageBuffer: Uint8Array,
    widthPercentage?: number,
    hexFormattedBackgroundColor?: string,
  ): Promise<string>;
}
