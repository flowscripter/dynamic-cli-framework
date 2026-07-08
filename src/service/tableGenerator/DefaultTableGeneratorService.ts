import type TableGeneratorService from "../../api/service/core/TableGeneratorService.ts";
import { Align } from "../../api/service/core/TableGeneratorService.ts";
import type { TableOptions } from "../../api/service/core/TableGeneratorService.ts";
import Table from "../../api/service/core/Table.ts";

const BORDER_TOP_LEFT = "┌";
const BORDER_TOP = "─";
const BORDER_TOP_MIDDLE = "┬";
const BORDER_TOP_RIGHT = "┐";
const BORDER_LEFT = "│";
const BORDER_MIDDLE_VERTICAL = "│";
const BORDER_RIGHT = "│";
const BORDER_LEFT_MIDDLE = "├";
const BORDER_MIDDLE = "─";
const BORDER_MIDDLE_MIDDLE = "┼";
const BORDER_RIGHT_MIDDLE = "┤";
const BORDER_BOTTOM_LEFT = "└";
const BORDER_BOTTOM = "─";
const BORDER_BOTTOM_MIDDLE = "┴";
const BORDER_BOTTOM_RIGHT = "┘";

export default class DefaultTableGeneratorService implements TableGeneratorService {
  colorEnabled = true;
  colorFunction: (text: string, hexFormattedColor: string) => string = (text) => text;
  backgroundColorFunction: (text: string, hexFormattedColor: string) => string = (text) => text;

  createTable(rowCount: number, columnCount: number, options?: TableOptions): Table {
    return new Table(rowCount, columnCount, options);
  }

  #resolveAlign(table: Table, rowIndex: number, columnIndex: number): Align {
    const cellOpts = table.getCell(rowIndex, columnIndex)?.options;
    if (cellOpts?.align !== undefined) return cellOpts.align;
    const rowOpts = table.getRowOptions(rowIndex);
    if (rowOpts?.align !== undefined) return rowOpts.align;
    const colOpts = table.getColumnOptions(columnIndex);
    if (colOpts?.align !== undefined) return colOpts.align;
    return table.options.align ?? Align.LEFT;
  }

  #calculateColumnWidths(table: Table): number[] {
    const border = table.options.border !== false;
    const padding = table.options.padding ?? 1;
    const maxWidth = table.options.maxWidth ?? 80;

    const borderOverhead = border ? table.columnCount + 1 : Math.max(table.columnCount - 1, 0);
    const paddingOverhead = table.columnCount * 2 * padding;
    const contentBudget = Math.max(maxWidth - borderOverhead - paddingOverhead, table.columnCount);

    const naturalWidths: number[] = [];
    for (let col = 0; col < table.columnCount; col++) {
      let maxCellWidth = 0;
      for (let row = 0; row < table.rowCount; row++) {
        const cell = table.getCell(row, col);
        if (cell) {
          const lines = cell.contents.split("\n");
          for (const line of lines) {
            const w = Bun.stringWidth(line);
            if (w > maxCellWidth) maxCellWidth = w;
          }
        }
      }
      const colOpts = table.getColumnOptions(col);
      if (colOpts?.minWidth !== undefined && maxCellWidth < colOpts.minWidth) {
        maxCellWidth = colOpts.minWidth;
      }
      if (colOpts?.maxWidth !== undefined && maxCellWidth > colOpts.maxWidth) {
        maxCellWidth = colOpts.maxWidth;
      }
      naturalWidths.push(maxCellWidth);
    }

    const totalNatural = naturalWidths.reduce((a, b) => a + b, 0);

    if (totalNatural <= contentBudget) {
      const surplus = contentBudget - totalNatural;
      const totalFlexWeight = this.#sumFlexWeights(table);
      if (surplus > 0 && totalFlexWeight > 0) {
        this.#distributeGrow(table, naturalWidths, surplus, totalFlexWeight);
      }
    } else {
      const excess = totalNatural - contentBudget;
      this.#distributeShrink(table, naturalWidths, excess);
    }

    return naturalWidths;
  }

  #sumFlexWeights(table: Table): number {
    let total = 0;
    for (let col = 0; col < table.columnCount; col++) {
      const colOpts = table.getColumnOptions(col);
      total += colOpts?.flexWeight ?? 0;
    }
    return total;
  }

  #distributeGrow(table: Table, widths: number[], surplus: number, totalFlexWeight: number): void {
    let remaining = surplus;
    for (let col = 0; col < table.columnCount; col++) {
      const colOpts = table.getColumnOptions(col);
      const weight = colOpts?.flexWeight ?? 0;
      if (weight <= 0) continue;
      const share = Math.floor((weight / totalFlexWeight) * surplus);
      let newWidth = widths[col]! + share;
      if (colOpts?.maxWidth !== undefined && newWidth > colOpts.maxWidth) {
        newWidth = colOpts.maxWidth;
      }
      const added = newWidth - widths[col]!;
      widths[col] = newWidth;
      remaining -= added;
    }
    // distribute any rounding remainder to first flex column
    if (remaining > 0) {
      for (let col = 0; col < table.columnCount; col++) {
        const colOpts = table.getColumnOptions(col);
        if ((colOpts?.flexWeight ?? 0) > 0) {
          let newWidth = widths[col]! + remaining;
          if (colOpts?.maxWidth !== undefined && newWidth > colOpts.maxWidth) {
            newWidth = colOpts.maxWidth;
          }
          widths[col] = newWidth;
          break;
        }
      }
    }
  }

  #distributeShrink(table: Table, widths: number[], excess: number): void {
    let remaining = excess;
    const shrinkable = new Set<number>();
    for (let col = 0; col < table.columnCount; col++) {
      const colOpts = table.getColumnOptions(col);
      if ((colOpts?.flexWeight ?? 0) > 0) {
        shrinkable.add(col);
      }
    }

    while (remaining > 0 && shrinkable.size > 0) {
      let totalWeightedWidth = 0;
      for (const col of shrinkable) {
        const colOpts = table.getColumnOptions(col);
        totalWeightedWidth += (colOpts?.flexWeight ?? 0) * widths[col]!;
      }
      if (totalWeightedWidth <= 0) break;

      let shrank = false;
      for (const col of shrinkable) {
        if (remaining <= 0) break;
        const colOpts = table.getColumnOptions(col);
        const weight = colOpts?.flexWeight ?? 0;
        const share = Math.max(
          1,
          Math.floor(((weight * widths[col]!) / totalWeightedWidth) * remaining),
        );
        const minWidth = colOpts?.minWidth ?? 1;
        const maxShrink = widths[col]! - minWidth;
        if (maxShrink <= 0) {
          shrinkable.delete(col);
          continue;
        }
        const actual = Math.min(share, maxShrink);
        widths[col] = widths[col]! - actual;
        remaining -= actual;
        shrank = true;
        if (widths[col]! <= minWidth) {
          shrinkable.delete(col);
        }
      }
      if (!shrank) break;
    }
  }

  #wrapLine(line: string, width: number): string[] {
    if (width <= 0) return [line];
    if (Bun.stringWidth(line) <= width) return [line];

    const wrapped: string[] = [];
    const words = line.split(/(\s+)/);
    let currentLine = "";
    let currentWidth = 0;

    for (const word of words) {
      const wordWidth = Bun.stringWidth(word);
      if (currentWidth === 0) {
        if (wordWidth <= width) {
          currentLine = word;
          currentWidth = wordWidth;
        } else {
          this.#hardBreak(word, width, wrapped);
          currentLine = "";
          currentWidth = 0;
          if (wrapped.length > 0) {
            const last = wrapped[wrapped.length - 1]!;
            if (Bun.stringWidth(last) < width) {
              currentLine = wrapped.pop()!;
              currentWidth = Bun.stringWidth(currentLine);
            }
          }
        }
      } else if (currentWidth + wordWidth <= width) {
        currentLine += word;
        currentWidth += wordWidth;
      } else {
        wrapped.push(currentLine);
        const trimmed = word.replace(/^\s+/, "");
        const trimmedWidth = Bun.stringWidth(trimmed);
        if (trimmedWidth <= width) {
          currentLine = trimmed;
          currentWidth = trimmedWidth;
        } else {
          this.#hardBreak(trimmed, width, wrapped);
          currentLine = "";
          currentWidth = 0;
          if (wrapped.length > 0) {
            const last = wrapped[wrapped.length - 1]!;
            if (Bun.stringWidth(last) < width) {
              currentLine = wrapped.pop()!;
              currentWidth = Bun.stringWidth(currentLine);
            }
          }
        }
      }
    }
    if (currentLine.length > 0) {
      wrapped.push(currentLine);
    }
    return wrapped.length > 0 ? wrapped : [""];
  }

  #hardBreak(text: string, width: number, output: string[]): void {
    let remaining = text;
    while (Bun.stringWidth(remaining) > width) {
      let breakAt = 0;
      let w = 0;
      for (const char of remaining) {
        const cw = Bun.stringWidth(char);
        if (w + cw > width) break;
        w += cw;
        breakAt += char.length;
      }
      if (breakAt === 0) breakAt = 1;
      output.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt);
    }
    if (remaining.length > 0) {
      output.push(remaining);
    }
  }

  #wrapCellContent(contents: string, width: number): string[] {
    const inputLines = contents.split("\n");
    const result: string[] = [];
    for (const line of inputLines) {
      result.push(...this.#wrapLine(line, width));
    }
    return result.length > 0 ? result : [""];
  }

  #alignText(text: string, width: number, align: Align): string {
    const textWidth = Bun.stringWidth(text);
    const gap = width - textWidth;
    if (gap <= 0) return text;
    switch (align) {
      case Align.LEFT:
        return text + " ".repeat(gap);
      case Align.RIGHT:
        return " ".repeat(gap) + text;
      case Align.CENTER: {
        const left = Math.floor(gap / 2);
        const right = gap - left;
        return " ".repeat(left) + text + " ".repeat(right);
      }
    }
  }

  #colorBorder(char: string, table: Table): string {
    let result = char;
    if (this.colorEnabled && table.options.borderBackgroundColor) {
      result = this.backgroundColorFunction(result, table.options.borderBackgroundColor);
    }
    if (this.colorEnabled && table.options.borderColor) {
      result = this.colorFunction(result, table.options.borderColor);
    }
    return result;
  }

  render(table: Table): string {
    const border = table.options.border !== false;
    const padding = table.options.padding ?? 1;
    const columnWidths = this.#calculateColumnWidths(table);
    const pad = " ".repeat(padding);

    const wrappedCells: string[][][] = [];
    const rowHeights: number[] = [];
    for (let row = 0; row < table.rowCount; row++) {
      const rowCells: string[][] = [];
      let maxHeight = 1;
      for (let col = 0; col < table.columnCount; col++) {
        const cell = table.getCell(row, col);
        const lines = this.#wrapCellContent(cell?.contents ?? "", columnWidths[col]!);
        rowCells.push(lines);
        if (lines.length > maxHeight) maxHeight = lines.length;
      }
      wrappedCells.push(rowCells);
      rowHeights.push(maxHeight);
    }

    const output: string[] = [];

    if (border) {
      output.push(
        this.#renderHorizontalBorder(
          table,
          columnWidths,
          padding,
          BORDER_TOP_LEFT,
          BORDER_TOP,
          BORDER_TOP_MIDDLE,
          BORDER_TOP_RIGHT,
        ),
      );
    }

    for (let row = 0; row < table.rowCount; row++) {
      for (let subLine = 0; subLine < rowHeights[row]!; subLine++) {
        let line = "";
        if (border) line += this.#colorBorder(BORDER_LEFT, table);
        for (let col = 0; col < table.columnCount; col++) {
          if (!border && col > 0) line += " ".repeat(padding * 2);
          const cellLines = wrappedCells[row]![col]!;
          const content = subLine < cellLines.length ? cellLines[subLine]! : "";
          const align = this.#resolveAlign(table, row, col);
          const aligned = this.#alignText(content, columnWidths[col]!, align);
          line += pad + aligned + pad;
          if (border && col < table.columnCount - 1) {
            line += this.#colorBorder(BORDER_MIDDLE_VERTICAL, table);
          }
        }
        if (border) line += this.#colorBorder(BORDER_RIGHT, table);
        output.push(border ? line : line.trimEnd());
      }

      if (border && row < table.rowCount - 1) {
        output.push(
          this.#renderHorizontalBorder(
            table,
            columnWidths,
            padding,
            BORDER_LEFT_MIDDLE,
            BORDER_MIDDLE,
            BORDER_MIDDLE_MIDDLE,
            BORDER_RIGHT_MIDDLE,
          ),
        );
      }
    }

    if (border) {
      output.push(
        this.#renderHorizontalBorder(
          table,
          columnWidths,
          padding,
          BORDER_BOTTOM_LEFT,
          BORDER_BOTTOM,
          BORDER_BOTTOM_MIDDLE,
          BORDER_BOTTOM_RIGHT,
        ),
      );
    }

    return output.join("\n");
  }

  #renderHorizontalBorder(
    table: Table,
    columnWidths: number[],
    padding: number,
    left: string,
    horizontal: string,
    middle: string,
    right: string,
  ): string {
    let line = this.#colorBorder(left, table);
    for (let col = 0; col < table.columnCount; col++) {
      const segment = horizontal.repeat(columnWidths[col]! + padding * 2);
      line += this.#colorBorder(segment, table);
      if (col < table.columnCount - 1) {
        line += this.#colorBorder(middle, table);
      }
    }
    line += this.#colorBorder(right, table);
    return line;
  }
}
