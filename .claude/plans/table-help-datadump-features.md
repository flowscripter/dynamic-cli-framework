# Plan: Table Service, Help Rendering Improvement, Data Dump Generator

## Feature 1: Table Service

### New Files

#### `src/api/service/core/TableGeneratorService.ts`

API interface. Exports:

- `TABLE_GENERATOR_SERVICE_ID` constant
- `Align` enum: `LEFT`, `CENTER`, `RIGHT`
- `TableOptions`: `border` (default true), `borderColor`,
  `borderBackgroundColor`, `padding` (default 1), `maxWidth` (default 80),
  `align` (default LEFT)
- `ColumnOptions`: `flexWeight` (default 0, rigid), `minWidth`, `maxWidth`,
  `align`
- `RowOptions`: `align`
- `CellOptions`: `align`
- `TableGeneratorService` interface with `render(table: Table): string`

#### `src/api/service/core/Table.ts`

Data-builder class:

```
constructor(rowCount: number, columnCount: number, options?: TableOptions)

row(rowIndex, rowOptions): Table        // chainable, bounds-checked
column(columnIndex, columnOptions): Table
cell(rowIndex, columnIndex, contents, cellOptions?): Table

getColumnOptions(columnIndex): ColumnOptions | undefined
getRowOptions(rowIndex): RowOptions | undefined
getCell(rowIndex, columnIndex): { contents: string; options?: CellOptions } | undefined
```

Internal storage: `Map<number, ColumnOptions>`, `Map<number, RowOptions>`,
`Map<string, { contents, options }>` keyed by `"row,col"`.

#### `src/service/tableGenerator/DefaultTableGeneratorService.ts`

Properties: `colorEnabled`, `colorFunction`, `backgroundColorFunction`.

**Algorithm 1: Flex Column Width Calculation (`calculateColumnWidths`)**

1. `availableWidth` = `table.options.maxWidth` (default 80)
2. `borderOverhead` = border ? `columnCount + 1` : `columnCount - 1` (space
   separators)
3. `paddingOverhead` = `columnCount * 2 * padding`
4. `contentBudget` = `availableWidth - borderOverhead - paddingOverhead`
   (clamped to min `columnCount`)
5. For each column: `naturalWidth` = max `Bun.stringWidth()` of all cell
   contents, clamped by `minWidth`/`maxWidth`
6. `totalNaturalWidth` = sum of `naturalWidth` values
7. If fits: distribute surplus proportionally by `flexWeight` (CSS flex-grow).
   Columns with `flexWeight: 0` don't grow. Cap at `maxWidth`.
8. If exceeds: shrink proportionally by `flexWeight * width` (CSS flex-shrink).
   Iteratively remove columns that hit `minWidth` and redistribute remaining
   excess. Columns with `flexWeight: 0` don't shrink.
9. Return: array of final content widths per column

**Algorithm 2: Cell Content Wrapping (`wrapCellContent`)**

1. Split content by existing newlines
2. Word-wrap each line to column width using `Bun.stringWidth()`:
   - Split on whitespace boundaries
   - Hard-break words exceeding column width
   - Preserve ANSI escape sequences (don't count toward width)
3. Apply alignment (cascade: cell > row > column > table, first non-undefined
   wins):
   - LEFT: pad right
   - RIGHT: pad left
   - CENTER: pad evenly, extra to right

**Algorithm 3: Table Render (`renderTable`)**

1. Compute column widths (Algorithm 1)
2. Wrap all cells (Algorithm 2), store as `wrappedCells[row][col]: string[]`
3. For each row: `rowHeight` = max wrapped line count across cells
4. Build output: a. If border: top border `+---+---+` using `┌ ─ ┬ ┐` b. For
   each row, for each sub-line:
   - If border: start with `│`
   - For each column: `" ".repeat(padding)` + aligned content (or spaces if past
     cell lines) + `" ".repeat(padding)`
   - If border: `│` between columns and at end c. If border and not last row:
     row separator using `├ ─ ┼ ┤` d. If border: bottom border using `└ ─ ┴ ┘`
5. Apply borderColor/borderBackgroundColor via color functions
6. Return joined string

Border characters:

- Top: ┌ ─ ┬ ┐
- Middle: ├ ─ ┼ ┤
- Bottom: └ ─ ┴ ┘
- Sides: │

When `border: false`: no border chars, columns separated by spaces.

#### `src/service/tableGenerator/TableGeneratorServiceProvider.ts`

Standard provider pattern (follows TreePrinterServiceProvider):

- Constructor takes `servicePriority`
- `provide()` returns `{ service, commands: [] }`
- `initService()` resolves PrinterService, sets `colorEnabled`, `colorFunction`,
  `backgroundColorFunction`

#### Exports in `index.ts`

Add: `TABLE_GENERATOR_SERVICE_ID`, `TableGeneratorService` (type),
`TableOptions`/`ColumnOptions`/`RowOptions`/`CellOptions` (types), `Align`
(value), `Table` (class), `DefaultTableGeneratorService`,
`TableGeneratorServiceProvider`.

#### Tests

**`tests/service/tableGenerator/DefaultTableGeneratorService.test.ts`:**

- 2x2 table with border renders correct box-drawing chars
- 2x2 table without border renders space-separated columns
- Equal flex weights produce equal columns
- Flex weight 2:1 gives 2:1 ratio
- minWidth prevents shrinking below minimum
- maxWidth caps column width
- Long text wraps at word boundaries
- Single long word hard-breaks
- LEFT/RIGHT/CENTER alignment produces correct padding
- Alignment cascade: cell > row > column > table
- Empty cells render as blank space
- Multi-line cell content extends row height
- Border coloring applies color function
- 1x1 table
- padding=0
- Out-of-bounds indices throw

**`tests/service/tableGenerator/TableGeneratorServiceProvider.test.ts`:**

- `provide` returns service and empty commands
- `initService` sets colorEnabled and colorFunction from PrinterService

---

## Feature 2: Help Rendering via Table

### Modified Files

#### `src/api/service/core/PrinterService.ts`

Add `terminal` property to interface to expose terminal info (specifically
`columns()`).

=> I think this needs to be modified so that both stderrTerminal and
stdoutTerminal exist and are exposed as help output is to stdout.

#### `src/service/printer/DefaultPrinterService.ts`

Add public getter:

```
get terminal(): Terminal { return this.#stderrTerminal; }
```

=> I think this needs to be modified so that both stderrTerminal and
stdoutTerminal exist and are exposed as help output is to stdout.

#### `src/util/helpHelper.ts`

Refactor `printHelpSections` signature to accept `TableGeneratorService`:

```
printHelpSections(printerService, tableGeneratorService, sections)
```

Changes:

- Create a borderless 2-column Table per section
- Column 0: syntax (rigid, `flexWeight: 0`,
  `minWidth: MINIMUM_SYNTAX_COLUMN_WIDTH`)
- Column 1: description (`flexWeight: 1`, fills remaining space)
- `maxWidth` = `printerService.terminal.columns()`
- `border: false`, `padding: 1`
- Each HelpEntry becomes a row: syntax in col 0, description in col 1
- Tree-drawing chars (indentation) placed directly in col 0 cell content
- Render table and print result
- Remove/refactor `printSingleHelpEntry` (flatten entries into table rows)

#### `src/cli/BaseCLI.ts`

Register `TableGeneratorServiceProvider` at priority 70 (after
PrinterServiceProvider at 80).

#### Help command files

All callers of `printHelpSections` updated to retrieve `TableGeneratorService`
from context:

- `src/command/MultiCommandCliHelpCommand.ts`
- `src/command/SingleCommandCliHelpCommand.ts`
- `src/command/UsageCommand.ts` (if applicable)

#### Test updates

- `tests/command/MultiCommandCliHelpCommand.test.ts` -- include
  TableGeneratorService in context
- `tests/command/SingleCommandCliHelpCommand.test.ts` -- same
- `tests/command/UsageCommand.test.ts` -- same if applicable

### README.md

Document TableGeneratorService as a core service included in BaseCLI.

---

## Feature 3: Data Dump Generator

### New Files

#### `src/api/service/core/DataDumpGeneratorService.ts`

Exports:

- `DATA_DUMP_GENERATOR_SERVICE_ID` constant
- `DumpFormat` enum: `HEX` | `ASCII`
- `ByteRangeColor`: `{ start: number, end: number, color: string }` (byte values
  0-255, hex color)
- `HexDumpGenerateOptions`: `format` (default "hex"), `bytesPerGroup` (default
  4), `groupsPerRow` (default 8), `spacesBetweenGroups` (default 1),
  `colorScheme` (optional `ByteRangeColor[]`)
- `DataDumpGeneratorService` interface with
  `generate(data: Buffer, options?): string`

#### `src/service/dataDumpGenerator/DefaultDataDumpGeneratorService.ts`

Properties: `colorEnabled`, `colorFunction`.

Algorithm:

1. Resolve defaults for all options
2. `bytesPerRow` = `bytesPerGroup * groupsPerRow`
3. Iterate buffer in chunks of `bytesPerRow`: a. if format != ASCII: bytes as
   2-char hex, grouped by `bytesPerGroup`, separated by `spacesBetweenGroups`
   spaces. Apply colorScheme via colorFunction. Pad partial last row with
   spaces. b. if format == ASCII: single ascii character or `.`, grouped by
   `bytesPerGroup`, separated by `spacesBetweenGroups` spaces. Apply colorScheme
   via colorFunction. Pad partial last row with spaces.
4. Return rows joined by `\n`

#### `src/service/dataDumpGenerator/DataDumpGeneratorServiceProvider.ts`

Standard provider pattern:

- `initService()` resolves PrinterService, sets `colorEnabled`, `colorFunction`

#### Exports in `index.ts`

Add: `DATA_DUMP_GENERATOR_SERVICE_ID`, `DataDumpGeneratorService` (type),
`HexDumpGenerateOptions`/`ByteRangeColor`/`DumpFormat` (types),
`DefaultDataDumpGeneratorService`, `DataDumpGeneratorServiceProvider`.

#### Tests

**`tests/service/dataDumpGenerator/DefaultDataDumpGeneratorService.test.ts`:**

- Empty buffer produces empty string
- Single byte renders correct hex
- Single byte renders correct ascii
- Full row (32 bytes default) renders correctly
- Partial last row pads with spaces
- Non-printable bytes render as `.`
- `bytesPerGroup: 2` changes grouping
- `groupsPerRow: 4` changes row width
- `spacesBetweenGroups: 2` changes spacing
- `format: "ascii"` renders ascii
- `format: "hex"` renders hex
- `colorScheme` applies coloring
- All printable ASCII (0x20-0x7E) render as themselves

**`tests/service/dataDumpGenerator/DataDumpGeneratorServiceProvider.test.ts`:**

- `provide` returns service and empty commands
- `initService` sets colorEnabled and colorFunction

### README.md

Add DataDumpGeneratorServiceProvider section under Core Service Providers.

---

## Implementation Order

1. **Phase 1:** Feature 1 (Table Service) -- no dependencies
2. **Phase 2:** Feature 2 (Help Rendering) -- depends on Phase 1
3. **Phase 3:** Feature 3 (Data Dump Generator) -- independent, can parallel
   Phase 2

## Notes

- `Bun.stringWidth` must be verified to handle ANSI escape codes correctly; if
  not, strip ANSI before measuring => as per Bun documentation it should handke
  ANSI escape and unicode and emoji.
- `printHelpSections` is internal (not exported from index.ts), so signature
  change is safe
- When all columns have `minWidth` exceeding `contentBudget`, accept overflow
  rather than violating minimums
- Capture `Terminal.columns()` once at start of help rendering, not per-row
