import { Buffer } from "node:buffer";

export const DATA_DUMP_GENERATOR_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/data-dump-generator-service";

export enum DumpFormat {
  HEX = "HEX",
  ASCII = "ASCII",
}

export interface ByteRangeColor {
  start: number;
  end: number;
  color: string;
}

export interface HexDumpGenerateOptions {
  format?: DumpFormat;
  bytesPerGroup?: number;
  groupsPerRow?: number;
  spacesBetweenGroups?: number;
  colorScheme?: ByteRangeColor[];
}

export default interface DataDumpGeneratorService {
  generate(data: Buffer, options?: HexDumpGenerateOptions): string;
}
