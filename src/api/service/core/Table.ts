import type {
  CellOptions,
  ColumnOptions,
  RowOptions,
  TableOptions,
} from "./TableGeneratorService.ts";

export default class Table {
  readonly rowCount: number;
  readonly columnCount: number;
  readonly options: TableOptions;

  readonly #columnOptions: Map<number, ColumnOptions> = new Map();
  readonly #rowOptions: Map<number, RowOptions> = new Map();
  readonly #cells: Map<string, { contents: string; options?: CellOptions }> = new Map();

  constructor(rowCount: number, columnCount: number, options?: TableOptions) {
    this.rowCount = rowCount;
    this.columnCount = columnCount;
    this.options = options ?? {};
  }

  row(rowIndex: number, rowOptions: RowOptions): Table {
    if (rowIndex < 0 || rowIndex >= this.rowCount) {
      throw new Error(`Row index ${rowIndex} out of bounds [0, ${this.rowCount})`);
    }
    this.#rowOptions.set(rowIndex, rowOptions);
    return this;
  }

  column(columnIndex: number, columnOptions: ColumnOptions): Table {
    if (columnIndex < 0 || columnIndex >= this.columnCount) {
      throw new Error(`Column index ${columnIndex} out of bounds [0, ${this.columnCount})`);
    }
    this.#columnOptions.set(columnIndex, columnOptions);
    return this;
  }

  cell(rowIndex: number, columnIndex: number, contents: string, cellOptions?: CellOptions): Table {
    if (rowIndex < 0 || rowIndex >= this.rowCount) {
      throw new Error(`Row index ${rowIndex} out of bounds [0, ${this.rowCount})`);
    }
    if (columnIndex < 0 || columnIndex >= this.columnCount) {
      throw new Error(`Column index ${columnIndex} out of bounds [0, ${this.columnCount})`);
    }
    this.#cells.set(`${rowIndex},${columnIndex}`, {
      contents,
      options: cellOptions,
    });
    return this;
  }

  getColumnOptions(columnIndex: number): ColumnOptions | undefined {
    return this.#columnOptions.get(columnIndex);
  }

  getRowOptions(rowIndex: number): RowOptions | undefined {
    return this.#rowOptions.get(rowIndex);
  }

  getCell(
    rowIndex: number,
    columnIndex: number,
  ): { contents: string; options?: CellOptions } | undefined {
    return this.#cells.get(`${rowIndex},${columnIndex}`);
  }
}
