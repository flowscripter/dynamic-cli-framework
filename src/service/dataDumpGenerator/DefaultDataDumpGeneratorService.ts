import { Buffer } from "node:buffer";
import type DataDumpGeneratorService from "../../api/service/core/DataDumpGeneratorService.ts";
import {
  type ByteRangeColor,
  DumpFormat,
  type HexDumpGenerateOptions,
} from "../../api/service/core/DataDumpGeneratorService.ts";

export default class DefaultDataDumpGeneratorService implements DataDumpGeneratorService {
  colorEnabled = true;
  colorFunction: (text: string, hexFormattedColor: string) => string = (text) => text;

  #colorByte(text: string, byteValue: number, colorScheme?: ByteRangeColor[]): string {
    if (!this.colorEnabled || !colorScheme) {
      return text;
    }
    for (const range of colorScheme) {
      if (byteValue >= range.start && byteValue <= range.end) {
        return this.colorFunction(text, range.color);
      }
    }
    return text;
  }

  generate(data: Buffer, options?: HexDumpGenerateOptions): string {
    if (data.length === 0) {
      return "";
    }

    const format = options?.format ?? DumpFormat.HEX;
    const bytesPerGroup = options?.bytesPerGroup ?? 4;
    const groupsPerRow = options?.groupsPerRow ?? 8;
    const spacesBetweenGroups = options?.spacesBetweenGroups ?? 1;
    const colorScheme = options?.colorScheme;

    const bytesPerRow = bytesPerGroup * groupsPerRow;
    const groupSeparator = " ".repeat(spacesBetweenGroups);
    const rows: string[] = [];

    for (let offset = 0; offset < data.length; offset += bytesPerRow) {
      const groups: string[] = [];

      for (let g = 0; g < groupsPerRow; g++) {
        const groupStart = offset + g * bytesPerGroup;
        let groupStr = "";

        for (let b = 0; b < bytesPerGroup; b++) {
          const byteIndex = groupStart + b;
          if (byteIndex < data.length) {
            const byteValue = data[byteIndex]!;
            let rendered: string;
            if (format === DumpFormat.ASCII) {
              rendered =
                byteValue >= 0x20 && byteValue <= 0x7e ? String.fromCharCode(byteValue) : ".";
            } else {
              rendered = byteValue.toString(16).toUpperCase().padStart(2, "0");
            }
            groupStr += this.#colorByte(rendered, byteValue, colorScheme);
          } else {
            // Pad partial group
            groupStr += format === DumpFormat.ASCII ? " " : "  ";
          }
        }

        groups.push(groupStr);
      }

      rows.push(groups.join(groupSeparator));
    }

    return rows.join("\n");
  }
}
