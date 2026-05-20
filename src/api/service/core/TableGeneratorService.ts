export const TABLE_GENERATOR_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/table-generator-service";

export enum Align {
  LEFT = 0,
  CENTER = 1,
  RIGHT = 2,
}

export interface TableOptions {
  border?: boolean;
  borderColor?: string;
  borderBackgroundColor?: string;
  padding?: number;
  maxWidth?: number;
  align?: Align;
}

export interface ColumnOptions {
  flexWeight?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: Align;
}

export interface RowOptions {
  align?: Align;
}

export interface CellOptions {
  align?: Align;
}

export default interface TableGeneratorService {
  render(table: Table): string;
}

import type Table from "./Table.ts";
