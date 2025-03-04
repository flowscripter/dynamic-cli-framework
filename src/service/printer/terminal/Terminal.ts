export default interface Terminal {
  clearLine(): Promise<void>;
  clearUpLines(count: number): Promise<void>;
  hideCursor(): Promise<void>;
  showCursor(): Promise<void>;
  write(text: string): Promise<void>;
  columns(): number;
}
