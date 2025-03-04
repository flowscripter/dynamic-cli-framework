export default interface Styler {
  colorEnabled: boolean;
  colorText(text: string, colorValue: number): string;
  italicText(text: string): string;
}
