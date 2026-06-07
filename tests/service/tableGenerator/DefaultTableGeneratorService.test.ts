import { describe, expect, test } from "bun:test";
import DefaultTableGeneratorService from "../../../src/service/tableGenerator/DefaultTableGeneratorService.ts";
import Table from "../../../src/api/service/core/Table.ts";
import { Align } from "../../../src/api/service/core/TableGeneratorService.ts";

describe("DefaultTableGeneratorService tests", () => {
  function createService(): DefaultTableGeneratorService {
    const service = new DefaultTableGeneratorService();
    service.colorEnabled = false;
    return service;
  }

  test("2x2 table with border renders correct box-drawing chars", () => {
    const service = createService();
    const table = new Table(2, 2, { maxWidth: 20, padding: 1 })
      .cell(0, 0, "A")
      .cell(0, 1, "B")
      .cell(1, 0, "C")
      .cell(1, 1, "D");

    const result = service.render(table);
    const lines = result.split("\n");

    // Top border
    expect(lines[0]).toMatch(/^┌─+┬─+┐$/);
    // Content rows have │ separators
    expect(lines[1]).toMatch(/^│.*│.*│$/);
    // Middle border
    expect(lines[2]).toMatch(/^├─+┼─+┤$/);
    // Bottom border
    expect(lines[4]).toMatch(/^└─+┴─+┘$/);
  });

  test("2x2 table without border renders space-separated columns", () => {
    const service = createService();
    const table = new Table(2, 2, { border: false, maxWidth: 20, padding: 1 })
      .cell(0, 0, "A")
      .cell(0, 1, "B")
      .cell(1, 0, "C")
      .cell(1, 1, "D");

    const result = service.render(table);
    const lines = result.split("\n");

    expect(lines.length).toBe(2);
    // No box-drawing characters
    expect(result).not.toContain("│");
    expect(result).not.toContain("─");
    // Content rows should contain the cell values with spacing
    expect(lines[0]).toContain("A");
    expect(lines[0]).toContain("B");
    // Between columns there should be padding*2 = 2 spaces as separator
    // Format: pad + content + pad + (padding*2 spaces) + pad + content + pad
    expect(lines[0]).toMatch(/A\s+B/);
  });

  test("equal flex weights produce equal columns", () => {
    const service = createService();
    const table = new Table(1, 2, { maxWidth: 40, padding: 0 })
      .column(0, { flexWeight: 1 })
      .column(1, { flexWeight: 1 })
      .cell(0, 0, "X")
      .cell(0, 1, "Y");

    const result = service.render(table);
    const lines = result.split("\n");
    // With border, overhead = 3 (columnCount+1 = 3 border chars), padding = 0
    // Content budget = 40 - 3 = 37
    // Natural widths: 1 each = 2 total, surplus = 35
    // Each flex col gets ~17-18 chars
    // Find content row (second line)
    const contentLine = lines[1]!;
    // Extract the two cell widths from between │ chars
    const parts = contentLine.split("│").filter((s) => s.length > 0);
    expect(parts.length).toBe(2);
    const diff = Math.abs(parts[0]!.length - parts[1]!.length);
    expect(diff).toBeLessThanOrEqual(1);
  });

  test("flex weight 2:1 gives proportional distribution", () => {
    const service = createService();
    const table = new Table(1, 2, { maxWidth: 40, padding: 0 })
      .column(0, { flexWeight: 2 })
      .column(1, { flexWeight: 1 })
      .cell(0, 0, "X")
      .cell(0, 1, "Y");

    const result = service.render(table);
    const lines = result.split("\n");
    const contentLine = lines[1]!;
    const parts = contentLine.split("│").filter((s) => s.length > 0);
    expect(parts.length).toBe(2);
    // Col 0 should be wider than col 1
    expect(parts[0]!.length).toBeGreaterThan(parts[1]!.length);
  });

  test("minWidth prevents shrinking below minimum", () => {
    const service = createService();
    // Use a very small maxWidth to force shrinking
    const table = new Table(1, 2, { maxWidth: 20, padding: 0 })
      .column(0, { flexWeight: 1, minWidth: 8 })
      .column(1, { flexWeight: 1 })
      .cell(0, 0, "ABCDEFGHIJ")
      .cell(0, 1, "ABCDEFGHIJ");

    const result = service.render(table);
    const lines = result.split("\n");
    const contentLine = lines[1]!;
    const parts = contentLine.split("│").filter((s) => s.length > 0);
    // Col 0 should be at least 8 wide
    expect(parts[0]!.length).toBeGreaterThanOrEqual(8);
  });

  test("maxWidth caps column width", () => {
    const service = createService();
    const table = new Table(1, 2, { maxWidth: 80, padding: 0 })
      .column(0, { flexWeight: 1, maxWidth: 5 })
      .column(1, { flexWeight: 1 })
      .cell(0, 0, "AB")
      .cell(0, 1, "CD");

    const result = service.render(table);
    const lines = result.split("\n");
    const contentLine = lines[1]!;
    const parts = contentLine.split("│").filter((s) => s.length > 0);
    // Col 0 should not exceed maxWidth of 5
    expect(parts[0]!.length).toBeLessThanOrEqual(5);
  });

  test("long text wraps at word boundaries", () => {
    const service = createService();
    // Column maxWidth=10 forces wrapping of "hello world foo bar"
    const table = new Table(1, 1, { maxWidth: 20, padding: 1 })
      .column(0, { maxWidth: 10 })
      .cell(0, 0, "hello world foo bar");

    const result = service.render(table);
    const lines = result.split("\n");
    const contentLines = lines.filter((l) => l.startsWith("│") && !l.includes("─"));
    expect(contentLines.length).toBeGreaterThan(1);
    // Each content line should have complete words (no mid-word breaks)
    for (const line of contentLines) {
      const content = line.replace(/│/g, "").trim();
      if (content.length > 0) {
        const words = content.split(/\s+/);
        for (const word of words) {
          expect(["hello", "world", "foo", "bar", ""].includes(word)).toBe(true);
        }
      }
    }
  });

  test("single long word hard-breaks", () => {
    const service = createService();
    // Column maxWidth=5 forces hard break of "ABCDEFGHIJKLMNOP"
    const table = new Table(1, 1, { maxWidth: 12, padding: 0 })
      .column(0, { maxWidth: 5 })
      .cell(0, 0, "ABCDEFGHIJKLMNOP");

    const result = service.render(table);
    const lines = result.split("\n");
    const contentLines = lines.filter((l) => l.startsWith("│") && !l.includes("─"));
    expect(contentLines.length).toBeGreaterThan(1);
    // Verify all characters are present
    const allContent = contentLines.map((l) => l.replace(/│/g, "").replace(/ /g, "")).join("");
    expect(allContent).toBe("ABCDEFGHIJKLMNOP");
  });

  test("LEFT/RIGHT/CENTER alignment produces correct padding", () => {
    const service = createService();
    // Use minWidth=10 to force column wider than content "AB" (2 chars)
    // LEFT (default)
    const tableL = new Table(1, 1, { maxWidth: 20, padding: 0 })
      .column(0, { minWidth: 10 })
      .cell(0, 0, "AB");
    let result = service.render(tableL);
    let contentLine = result.split("\n")[1]!;
    let content = contentLine.slice(1, -1); // strip border chars
    expect(content).toBe("AB" + " ".repeat(8));

    // RIGHT
    const tableR = new Table(1, 1, {
      maxWidth: 20,
      padding: 0,
      align: Align.RIGHT,
    })
      .column(0, { minWidth: 10 })
      .cell(0, 0, "AB");
    result = service.render(tableR);
    contentLine = result.split("\n")[1]!;
    content = contentLine.slice(1, -1);
    expect(content).toBe(" ".repeat(8) + "AB");

    // CENTER
    const tableC = new Table(1, 1, {
      maxWidth: 20,
      padding: 0,
      align: Align.CENTER,
    })
      .column(0, { minWidth: 10 })
      .cell(0, 0, "AB");
    result = service.render(tableC);
    contentLine = result.split("\n")[1]!;
    content = contentLine.slice(1, -1);
    expect(content).toBe(" ".repeat(4) + "AB" + " ".repeat(4));
  });

  test("alignment cascade: cell overrides row overrides column overrides table", () => {
    const service = createService();
    // Use minWidth=10 so column is wider than content "AB" (2 chars)
    const table = new Table(3, 1, {
      maxWidth: 20,
      padding: 0,
      align: Align.LEFT,
    })
      .column(0, { align: Align.RIGHT, minWidth: 10 })
      .row(1, { align: Align.CENTER })
      .cell(0, 0, "AB")
      .cell(1, 0, "AB")
      .cell(2, 0, "AB", { align: Align.LEFT });

    const result = service.render(table);
    const lines = result.split("\n");

    // Row 0: column override (RIGHT)
    const row0 = lines[1]!.slice(1, -1);
    expect(row0).toBe(" ".repeat(8) + "AB");

    // Row 1: row override (CENTER) takes precedence over column
    const row1 = lines[3]!.slice(1, -1);
    expect(row1).toBe(" ".repeat(4) + "AB" + " ".repeat(4));

    // Row 2: cell override (LEFT) takes precedence over column
    const row2 = lines[5]!.slice(1, -1);
    expect(row2).toBe("AB" + " ".repeat(8));
  });

  test("empty cells render as blank space", () => {
    const service = createService();
    const table = new Table(1, 2, { maxWidth: 20, padding: 1 }).cell(0, 0, "Hi");
    // cell(0, 1) not set

    const result = service.render(table);
    const lines = result.split("\n");
    const contentLine = lines[1]!;
    // Should render without error
    expect(contentLine).toContain("Hi");
    // The missing cell should render as blank space
    const parts = contentLine.split("│").filter((s) => s.length > 0);
    expect(parts.length).toBe(2);
    expect(parts[1]!.trim()).toBe("");
  });

  test("multi-line cell content extends row height", () => {
    const service = createService();
    const table = new Table(1, 2, { maxWidth: 40, padding: 1 })
      .cell(0, 0, "line1\nline2\nline3")
      .cell(0, 1, "single");

    const result = service.render(table);
    const lines = result.split("\n");
    // Filter content lines (between top and bottom borders)
    const contentLines = lines.filter((l) => l.startsWith("│") && !l.includes("─"));
    // Row should have 3 sub-lines due to multi-line content
    expect(contentLines.length).toBe(3);
    expect(contentLines[0]).toContain("line1");
    expect(contentLines[0]).toContain("single");
    expect(contentLines[1]).toContain("line2");
    expect(contentLines[2]).toContain("line3");
  });

  test("border coloring applies color function to border characters", () => {
    const service = new DefaultTableGeneratorService();
    service.colorEnabled = true;
    service.colorFunction = (text, hex) => `[fg:${hex}]${text}[/fg]`;
    service.backgroundColorFunction = (text, hex) => `[bg:${hex}]${text}[/bg]`;

    const table = new Table(1, 1, {
      maxWidth: 20,
      padding: 0,
      borderColor: "#ff0000",
      borderBackgroundColor: "#0000ff",
    }).cell(0, 0, "X");

    const result = service.render(table);
    // Border chars should be wrapped with both color functions
    expect(result).toContain("[fg:#ff0000]");
    expect(result).toContain("[bg:#0000ff]");
    // Content should NOT be colored by border color function
    // The "X" itself should appear without color wrappers
    expect(result).toContain("X");
  });

  test("1x1 table renders correctly", () => {
    const service = createService();
    const table = new Table(1, 1, { maxWidth: 10, padding: 0 }).cell(0, 0, "Hi");

    const result = service.render(table);
    const lines = result.split("\n");
    // Should have 3 lines: top border, content, bottom border
    expect(lines.length).toBe(3);
    expect(lines[0]).toMatch(/^┌─+┐$/);
    expect(lines[1]).toMatch(/^│.*│$/);
    expect(lines[1]).toContain("Hi");
    expect(lines[2]).toMatch(/^└─+┘$/);
  });

  test("padding=0 works", () => {
    const service = createService();
    const table = new Table(1, 1, { maxWidth: 10, padding: 0 }).cell(0, 0, "AB");

    const result = service.render(table);
    const lines = result.split("\n");
    const contentLine = lines[1]!;
    // With padding=0, content sits directly against borders
    // │AB........│
    expect(contentLine.startsWith("│")).toBe(true);
    expect(contentLine.endsWith("│")).toBe(true);
    // No padding space between border and content
    expect(contentLine[1]).toBe("A");
  });

  test("out-of-bounds row index throws", () => {
    const table = new Table(2, 2);
    expect(() => table.row(5, { align: Align.LEFT })).toThrow(/out of bounds/);
    expect(() => table.row(-1, { align: Align.LEFT })).toThrow(/out of bounds/);
  });

  test("out-of-bounds column index throws", () => {
    const table = new Table(2, 2);
    expect(() => table.column(5, { flexWeight: 1 })).toThrow(/out of bounds/);
    expect(() => table.column(-1, { flexWeight: 1 })).toThrow(/out of bounds/);
  });

  test("out-of-bounds cell index throws", () => {
    const table = new Table(2, 2);
    expect(() => table.cell(5, 0, "X")).toThrow(/out of bounds/);
    expect(() => table.cell(0, 5, "X")).toThrow(/out of bounds/);
    expect(() => table.cell(-1, 0, "X")).toThrow(/out of bounds/);
    expect(() => table.cell(0, -1, "X")).toThrow(/out of bounds/);
  });
});
