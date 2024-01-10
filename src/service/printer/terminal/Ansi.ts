const CSI = "\x1b[";

export const CLEAR_LINE = CSI + "2K";
export const CURSOR_LEFT = CSI + "G";
export const CURSOR_UP = CSI + "1A";
export const HIDE_CURSOR = CSI + "?25l";
export const SHOW_CURSOR = CSI + "?25h";
export const ITALIC_START = CSI + "3m";
export const ITALIC_END = CSI + "23m";
