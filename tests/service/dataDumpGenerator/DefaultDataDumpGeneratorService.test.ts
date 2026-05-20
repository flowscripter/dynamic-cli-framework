import { Buffer } from "node:buffer";
import { describe, expect, test } from "bun:test";
import DefaultDataDumpGeneratorService from "../../../src/service/dataDumpGenerator/DefaultDataDumpGeneratorService.ts";
import { DumpFormat } from "../../../src/api/service/core/DataDumpGeneratorService.ts";

describe("DefaultDataDumpGeneratorService tests", () => {
  test("Empty buffer produces empty string", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = false;

    expect(service.generate(Buffer.alloc(0))).toEqual("");
  });

  test("Single byte renders correct hex", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = false;

    // 1 byte in a row of 32 (4*8): "FF" + 31*"  " padding, with group separators
    const result = service.generate(Buffer.from([0xff]));
    // First group: "FF      " (FF + 3 bytes padding = "FF" + "  "x3)
    // Remaining 7 groups: "        " (4 bytes padding each = "  "x4)
    const groups = [
      "FF      ",
      "        ",
      "        ",
      "        ",
      "        ",
      "        ",
      "        ",
      "        ",
    ];
    expect(result).toEqual(groups.join(" "));
  });

  test("Single byte renders correct ascii", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = false;

    const result = service.generate(Buffer.from([0x41]), {
      format: DumpFormat.ASCII,
    });
    // "A" + 3 space padding in first group, then 7 groups of 4 spaces
    const groups = [
      "A   ",
      "    ",
      "    ",
      "    ",
      "    ",
      "    ",
      "    ",
      "    ",
    ];
    expect(result).toEqual(groups.join(" "));
  });

  test("Full row (32 bytes) renders correctly", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = false;

    const data = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      data[i] = i;
    }

    const result = service.generate(data);
    const groups = [
      "00010203",
      "04050607",
      "08090A0B",
      "0C0D0E0F",
      "10111213",
      "14151617",
      "18191A1B",
      "1C1D1E1F",
    ];
    expect(result).toEqual(groups.join(" "));
  });

  test("Partial last row pads with spaces", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = false;

    // 33 bytes = 1 full row of 32 + 1 byte on second row
    const data = Buffer.alloc(33, 0xaa);
    const result = service.generate(data);
    const lines = result.split("\n");
    expect(lines.length).toEqual(2);

    // Second row: "AA" + padding
    const groups = [
      "AA      ",
      "        ",
      "        ",
      "        ",
      "        ",
      "        ",
      "        ",
      "        ",
    ];
    expect(lines[1]).toEqual(groups.join(" "));
  });

  test("Non-printable bytes render as '.' in ascii format", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = false;

    const data = Buffer.from([0x00, 0x1f, 0x7f, 0x80]);
    const result = service.generate(data, {
      format: DumpFormat.ASCII,
      bytesPerGroup: 4,
      groupsPerRow: 1,
    });
    expect(result).toEqual("....");
  });

  test("bytesPerGroup: 2 changes grouping", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = false;

    const data = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]);
    const result = service.generate(data, {
      bytesPerGroup: 2,
      groupsPerRow: 2,
    });
    expect(result).toEqual("AABB CCDD");
  });

  test("groupsPerRow: 4 changes row width", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = false;

    // 16 bytes with 4 groups of 4
    const data = Buffer.alloc(16, 0xff);
    const result = service.generate(data, {
      bytesPerGroup: 4,
      groupsPerRow: 4,
    });
    expect(result).toEqual("FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF");
  });

  test("spacesBetweenGroups: 2 changes spacing", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = false;

    const data = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]);
    const result = service.generate(data, {
      bytesPerGroup: 2,
      groupsPerRow: 2,
      spacesBetweenGroups: 2,
    });
    expect(result).toEqual("AABB  CCDD");
  });

  test("format: DumpFormat.ASCII renders ascii chars", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = false;

    const data = Buffer.from("abcdefgh");
    const result = service.generate(data, {
      format: DumpFormat.ASCII,
      bytesPerGroup: 4,
      groupsPerRow: 2,
    });
    expect(result).toEqual("abcd efgh");
  });

  test("format: DumpFormat.HEX (default) renders hex", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = false;

    const data = Buffer.from([0xde, 0xad]);
    const result = service.generate(data, {
      bytesPerGroup: 2,
      groupsPerRow: 1,
    });
    expect(result).toEqual("DEAD");
  });

  test("colorScheme applies coloring", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = true;
    service.colorFunction = (text, color) => `[${color}:${text}]`;

    const data = Buffer.from([0x00, 0x41]);
    const result = service.generate(data, {
      bytesPerGroup: 2,
      groupsPerRow: 1,
      colorScheme: [
        { start: 0x00, end: 0x1f, color: "#ff0000" },
        { start: 0x20, end: 0x7e, color: "#00ff00" },
      ],
    });
    expect(result).toEqual("[#ff0000:00][#00ff00:41]");
  });

  test("All printable ASCII (0x20-0x7E) render as themselves in ascii format", () => {
    const service = new DefaultDataDumpGeneratorService();
    service.colorEnabled = false;

    const printable: number[] = [];
    for (let i = 0x20; i <= 0x7e; i++) {
      printable.push(i);
    }
    const data = Buffer.from(printable);
    const result = service.generate(data, {
      format: DumpFormat.ASCII,
      bytesPerGroup: printable.length,
      groupsPerRow: 1,
    });

    let expected = "";
    for (let i = 0x20; i <= 0x7e; i++) {
      expected += String.fromCharCode(i);
    }
    expect(result).toEqual(expected);
  });
});
