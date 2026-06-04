export default interface Styler {
  colorEnabled: boolean;
  hyperlinksEnabled: boolean;
  colorText(text: string, colorValue: number): string;
  backgroundColorText(text: string, colorValue: number): string;
  italicText(text: string): string;
  hyperlink(text: string, url: string): string;
}
