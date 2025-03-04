import { Color } from "./Color";

const commonTheme: Array<number> = [];

commonTheme[Color.YELLOW] = 0xb58900;
commonTheme[Color.ORANGE] = 0xcb4b16;
commonTheme[Color.RED] = 0xdc322f;
commonTheme[Color.MAGENTA] = 0xd33682;
commonTheme[Color.VIOLET] = 0x6c71c4;
commonTheme[Color.BLUE] = 0x268bd2;
commonTheme[Color.CYAN] = 0x2aa198;
commonTheme[Color.GREEN] = 0x859900;

export function getLightModeTheme(): Array<number> {
  const lightModeTheme: Array<number> = [...commonTheme];

  lightModeTheme[Color.PRIMARY] = 0x657b83;
  lightModeTheme[Color.SECONDARY] = 0x93a1a1;
  lightModeTheme[Color.EMPHASISED] = 0x586e75;
  lightModeTheme[Color.SELECTED] = 0xeee8d5;

  return lightModeTheme;
}

export function getDarkModeTheme(): Array<number> {
  const darkModeTheme: Array<number> = [...commonTheme];

  darkModeTheme[Color.PRIMARY] = 0x839496;
  darkModeTheme[Color.SECONDARY] = 0x586e75;
  darkModeTheme[Color.EMPHASISED] = 0x93a1a1;
  darkModeTheme[Color.SELECTED] = 0x073642;

  return darkModeTheme;
}
