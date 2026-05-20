const CSI = "\x1b[";
const OSC = "\x1b]";
const BEL = "\x07";
const SEP = ";";

export const CLEAR_LINE = CSI + "2K";
export const CURSOR_LEFT = CSI + "G";
export const CURSOR_UP = CSI + "1A";
export const HIDE_CURSOR = CSI + "?25l";
export const SHOW_CURSOR = CSI + "?25h";
export const ITALIC_START = CSI + "3m";
export const ITALIC_END = CSI + "23m";
export const FOREGROUND_COLOR_END = CSI + "39m";
export const BACKGROUND_COLOR_END = CSI + "49m";
export const HYPERLINK_END = `${OSC}8${SEP}${SEP}${BEL}`;

export function foregroundColorStart(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function backgroundColorStart(r: number, g: number, b: number): string {
  return `\x1b[48;2;${r};${g};${b}m`;
}

export function hyperlinkStart(url: string): string {
  return `${OSC}8${SEP}${SEP}${url}${BEL}`;
}
