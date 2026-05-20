# Implementation Plan: Banner Subtitles/Colors, Background Colors, TreePrinter

## Context

Four independent features:

1. Banner subMessage + color effects in `AsciiBannerGeneratorService` /
   `DefaultAsciiBannerGeneratorService`, plus a new
   `ChiselFontAsciiBannerGeneratorService`
2. Background color methods in `PrinterService` to mirror the foreground color
   API
3. A new `TreePrinterService` that renders tree structures using box-drawing
   ASCII characters

---

## Feature 1: Banner subMessage + Color Effects + ChiselFontAsciiBannerGeneratorService

### Overview of changes

- Rename "subtitle" -> "subMessage" everywhere
- Move `fontName` argument into a new `BannerGenerateOptions` options object
- Add `subMessage` and `colorEffects` to `BannerGenerateOptions`
- Strip all FIGlet references from the `AsciiBannerGeneratorService` API
  interface (keep them in `DefaultAsciiBannerGeneratorService` only)
- Add color effect types and interfaces (fixed color, gradient, rainbow) to the
  API
- Implement color effect rendering in `DefaultAsciiBannerGeneratorService` as a
  post-processing step
- Add new `ChiselFontAsciiBannerGeneratorService` with its own font and 6-color
  palette control
- Update `CLIConfig` to add `subMessage?: string`
- Update `BannerServiceProvider` to pass subMessage from CLIConfig to generate()

### New/modified files

| File                                                                              | Action                                                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/api/CLIConfig.ts`                                                            | Add `subMessage?: string`                                                    |
| `src/api/service/core/AsciiBannerGeneratorService.ts`                             | Overhaul: add options types, remove FIGlet refs, rename subtitle->subMessage |
| `src/service/asciiBannerGenerator/DefaultAsciiBannerGeneratorService.ts`          | Implement options, color effects, subMessage                                 |
| `src/service/chiselAsciiBannerGenerator/ChiselFontAsciiBannerGeneratorService.ts` | New                                                                          |
| `src/service/chiselAsciiBannerGenerator/chisel.flf.json`                          | New (converted from chisel.flf)                                              |
| `src/service/banner/BannerServiceProvider.ts`                                     | Pass subMessage, update generate() call                                      |
| `index.ts`                                                                        | Export ChiselFontAsciiBannerGeneratorService                                 |

### 1a. API interface (`src/api/service/core/AsciiBannerGeneratorService.ts`)

New types to define (no FIGlet references in this file):

```typescript
export type ColorEffectDirection = "horizontal" | "vertical";

export interface FixedColorEffect {
  type: "fixed";
  color: string; // hex "#rrggbb"
}

export interface GradientColorEffect {
  type: "gradient";
  colors: string[]; // 2+ hex color stops
  direction: ColorEffectDirection;
}

export interface RainbowColorEffect {
  type: "rainbow";
  spread?: number; // default 8.0
  frequency?: number; // default 0.3
  seed?: number; // default 0 = random seed
  direction: ColorEffectDirection;
}

export type ColorEffect =
  | FixedColorEffect
  | GradientColorEffect
  | RainbowColorEffect;

export interface BannerColorEffects {
  background?: ColorEffect; // entire rendered output (title + subMessage)
  messageForeground?: ColorEffect; // banner title chars only
  subMessageForeground?: ColorEffect; // subMessage chars only (direction is no-op: single line)
}

export interface BannerGenerateOptions {
  fontName?: string; // consumed by DefaultAsciiBannerGeneratorService only
  subMessage?: string;
  colorEffects?: BannerColorEffects;
}
```

Updated interface signature:

```typescript
export default interface AsciiBannerGeneratorService {
  registerFont(fontName: string, fontDefinition: string): void;
  getRegisteredFonts(): ReadonlyArray<string>;
  generate(message: string, options?: BannerGenerateOptions): Promise<string>;
}
```

### 1b. `DefaultAsciiBannerGeneratorService` implementation

`generate(message, options)` steps:

1. Read `options?.fontName` (default `"standard"`), validate registered
2. Run figlet to produce banner title lines (existing logic)
3. If `options?.subMessage` provided:
   - Format:
     `subMessage.toUpperCase().split('').map(c => c === ' ' ? '  ' : c + ' ').join('').trimEnd()`
   - Compute `bannerWidth` (max title line length), `subMessageWidth` (formatted
     length)
   - If `bannerWidth >= subMessageWidth`: pad subMessage left by
     `Math.floor((bannerWidth - subMessageWidth) / 2)` spaces
   - Else: pad each title line left by
     `Math.floor((subMessageWidth - bannerWidth) / 2)` spaces
4. Apply `options?.colorEffects` as a post-processing step (see below)
5. Return `"\n" + lines.join("\n") + "\n"`

**Color effect rendering** (private helper methods):

`applyForegroundEffect(lines: string[], effect: ColorEffect): string[]`

- For `fixed`: wrap every non-space char in `\x1b[38;2;R;G;Bm ... \x1b[39m`
- For `gradient horizontal`: per line, interpolate across character positions
  (x) to pick color
- For `gradient vertical`: assign one interpolated color per line (y)
- For `rainbow horizontal`: lolcat algorithm per character (x, y) where y=line
  index
- For `rainbow vertical`: lolcat algorithm per line (y), all chars in line same
  color

`applyBackgroundEffect(lines: string[], effect: ColorEffect): string[]`

- Same structure but uses background ANSI codes `\x1b[48;2;R;G;Bm ... \x1b[49m`

**Lolcat algorithm** (pure TypeScript, no dependency needed):

```typescript
function rainbowColor(
  freq: number,
  spread: number,
  seed: number,
  x: number,
  y: number,
): [number, number, number] {
  const h = (freq * (x / spread) + seed + (y * freq / spread)) % 1.0;
  return hslToRgb(h, 1.0, 0.5); // standard HSL->RGB conversion
}
```

`hslToRgb` is a small inline helper (~20 lines).

**Gradient interpolation**:

```typescript
function interpolateColors(
  colors: [number, number, number][],
  position: number,
  total: number,
): [number, number, number];
```

Lerp between color stops based on `position / (total - 1)`.

Color effect application order:

1. Apply `messageForeground` to the title lines
2. Apply `subMessageForeground` to the subMessage line (direction no-op: treat
   as single line horizontal fixed/gradient/rainbow)
3. Combine all lines
4. Apply `background` to all combined lines

### 1c. `ChiselFontAsciiBannerGeneratorService`

New file:
`src/service/chiselAsciiBannerGenerator/ChiselFontAsciiBannerGeneratorService.ts`

The Chisel font embeds ANSI color codes directly in the FIGlet font definition
using 3 brightness levels:

- Highlight: fg=97 bg=107
- Light: fg=37 bg=47
- Shadow: fg=90 bg=100

`ChiselBannerColors` type (defined alongside
ChiselFontAsciiBannerGeneratorService):

```typescript
export interface ChiselBannerColors {
  highlightForeground?: number; // default 97
  highlightBackground?: number; // default 107
  lightForeground?: number; // default 37
  lightBackground?: number; // default 47
  shadowForeground?: number; // default 90
  shadowBackGround?: number; // default 100
}
```

Extended options for this implementation only:

```typescript
export interface ChiselBannerGenerateOptions extends BannerGenerateOptions {
  chiselColors?: ChiselBannerColors;
}
```

`generate(message, options?)` implementation:

1. Generate banner using figlet with the chisel font (pre-loaded)
2. If `options?.chiselColors` provided, do string replacement on the generated
   output:
   - Replace each default ANSI code number with the custom value
   - e.g. replace `\x1b[97m` with `\x1b[{highlightFg}m`
   - Uses a simple regex replacement:
     `output.replace(/\x1b\[(\d+)m/g, (_, n) => \`\x1b[\${chiselColorMap[n] ??
     n}m\`)`
3. Apply `options?.subMessage` centering (same logic as Default)
4. Apply `options?.colorEffects` (same helpers - they will work with or without
   embedded ANSI codes already in text, though mixing may produce complex
   output; document as user responsibility)
5. `registerFont()` throws:
   `throw new Error("ChiselFontAsciiBannerGeneratorService supports only the built-in chisel font")`
6. `getRegisteredFonts()` returns `["chisel"]`

**Font file**: `src/service/chiselAsciiBannerGenerator/chisel.flf.json`

- Same format as `standard.flf.json`: `{ "font": "<definition>" }`
- Needs to be created from `chisel.flf` source
- NOTE: The `chisel.flf` file must be sourced and converted before implementing.
  It is in the root of the repo.

### 1d. `CLIConfig` and `BannerServiceProvider`

`CLIConfig`: add `readonly subMessage?: string`

`BannerServiceProvider.initService()`:

- Change generate call to:
  `asciiBannerGeneratorService.generate(cliConfig.name.toUpperCase(), { fontName: this.fontName, subMessage: cliConfig.subMessage })`
- Remove now-separate `fontName` parameter from constructor only if desired -
  actually keep constructor `fontName` param as it is, just pass it in options
  object instead of positional arg

### Tasks - Feature 1

- [x] Update `src/api/CLIConfig.ts`: add `subMessage?: string`
- [x] Overhaul `src/api/service/core/AsciiBannerGeneratorService.ts`: add all
      color effect types and `BannerGenerateOptions`, update `generate()`
      signature, remove FIGlet references from comments, rename
      subtitle->subMessage
- [x] Update `DefaultAsciiBannerGeneratorService.generate()`: accept
      `options?: BannerGenerateOptions`, read `fontName` from options, implement
      subMessage centering logic (same algorithm as previously planned for
      subtitle)
- [x] Implement private color effect helpers in
      `DefaultAsciiBannerGeneratorService`: `applyForegroundEffect`,
      `applyBackgroundEffect`, `rainbowColor`, `hslToRgb`, `interpolateColors`
- [x] Apply color effects post-processing in `generate()` in correct order
- [x] Convert `chisel.flf` to
      `src/service/chiselAsciiBannerGenerator/chisel.flf.json` (requires font
      source file)
- [x] Create
      `src/service/chiselAsciiBannerGenerator/ChiselFontAsciiBannerGeneratorService.ts`
- [x] Update `BannerServiceProvider.initService()` to use new options signature
- [x] Add exports to `index.ts` for `ChiselFontAsciiBannerGeneratorService` and
      `ChiselBannerColors`/`ChiselBannerGenerateOptions`
- [x] Update tests in
      `tests/service/asciiBannerGenerator/DefaultAsciiBannerGeneratorService.test.ts`:
  - subMessage appears, is uppercase and double-spaced (renamed from subtitle)
  - subMessage centering: narrower than banner, wider than banner
  - No subMessage when omitted
  - Fixed foreground color effect applies ANSI codes to title chars
  - Gradient horizontal: different colors per char within a line
  - Gradient vertical: different color per line
  - Rainbow horizontal/vertical: outputs vary per position
  - Background effect wraps all lines
  - Color effects disabled when colorEnabled=false (or effect is undefined)
- [x] Add tests in new
      `tests/service/chiselAsciiBannerGenerator/ChiselFontAsciiBannerGeneratorService.test.ts`:
  - `registerFont()` throws
  - `getRegisteredFonts()` returns `["chisel"]`
  - `generate()` returns non-empty string with ANSI codes
  - Custom chisel colors replace default ANSI codes in output
  - subMessage and color effects work same as Default

---

## Feature 2: PrinterService Background Colors

### Files to modify

| File                                           | Change                     |
| ---------------------------------------------- | -------------------------- |
| `src/service/printer/terminal/Ansi.ts`         | Add `BACKGROUND_COLOR_END` |
| `src/service/printer/terminal/Styler.ts`       | Add `bgColorText()`        |
| `src/service/printer/terminal/TtyStyler.ts`    | Implement `bgColorText()`  |
| `src/api/service/core/PrinterService.ts`       | Add bg color methods       |
| `src/service/printer/DefaultPrinterService.ts` | Implement bg color methods |

### ANSI background code approach

```typescript
// In TtyStyler.bgColorText():
bgColorText(text: string, colorValue: number): string {
  if (!this.colorEnabled) return text;
  const r = (colorValue >> 16) & 0xFF;
  const g = (colorValue >> 8) & 0xFF;
  const b = colorValue & 0xFF;
  if (this.colorLevel === 3) {
    return `\x1b[48;2;${r};${g};${b}m${text}${BACKGROUND_COLOR_END}`;
  }
  if (this.colorLevel === 2) {
    return Bun.color(colorValue, "ansi-256").replace('[38;', '[48;') + text + BACKGROUND_COLOR_END;
  }
  // 16-color: shift FG code 30-37/90-97 to BG code 40-47/100-107
  return Bun.color(colorValue, "ansi-16").replace(/\[(\d+)m/, (_, n) => `[${Number(n) + 10}m`) + text + BACKGROUND_COLOR_END;
}
```

### New `PrinterService` methods (semantic + named + custom)

Semantic (theme-dependent, same Color enum indices as fg counterparts):

- `bgPrimary(message: string): string`
- `bgSecondary(message: string): string`
- `bgEmphasised(message: string): string`
- `bgSelected(message: string): string`

Named (fixed solarized palette):

- `bgYellow`, `bgOrange`, `bgRed`, `bgMagenta`, `bgViolet`, `bgBlue`, `bgCyan`,
  `bgGreen`

Custom:

- `bgColor(message: string, hexFormattedColor: string): string` (same hex
  validation as `color()`)

All delegate to `this.#styler.bgColorText(message, this.#theme[Color.X])`.

### Tasks - Feature 2

- [x] Add `export const BACKGROUND_COLOR_END = "\x1b[49m"` to `Ansi.ts`
- [x] Add `bgColorText(text: string, colorValue: number): string` to `Styler`
      interface
- [x] Implement `bgColorText` in `TtyStyler` (code above)
- [x] Add all bg color method signatures to `PrinterService` interface with
      JSDoc
- [x] Implement all bg color methods in `DefaultPrinterService`
- [x] Add tests to `tests/service/printer/DefaultPrinterService.test.ts`:
  - `bgBlue("text")` at colorLevel 3 returns `\x1b[48;2;...m text \x1b[49m`
  - `bgColor("#268bd2", "text")` produces background code
  - `bgColor("invalid", "text")` throws/returns plain (match existing `color()`
    error behavior)
  - All named bg methods return text with background ANSI prefix when
    colorEnabled=true
  - All bg methods return plain text when colorEnabled=false

---

## Feature 3: TreePrinterService

### New files

| File                                                           | Purpose                                  |
| -------------------------------------------------------------- | ---------------------------------------- |
| `src/api/service/core/TreePrinterService.ts`                   | Interface + `TreeNode` type + service ID |
| `src/service/treePrinter/DefaultTreePrinterService.ts`         | Box-drawing tree renderer                |
| `src/service/treePrinter/TreePrinterServiceProvider.ts`        | ServiceProvider wrapper                  |
| `tests/service/treePrinter/DefaultTreePrinterService.test.ts`  | Unit tests                               |
| `tests/service/treePrinter/TreePrinterServiceProvider.test.ts` | Provider tests                           |

### Interface (`src/api/service/core/TreePrinterService.ts`)

```typescript
export const TREE_PRINTER_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/tree-printer-service";

export interface TreeNode {
  label: string;
  children?: Array<TreeNode | string>;
}

export default interface TreePrinterService {
  colorEnabled: boolean;
  colorFunction: (text: string, hexFormattedColor: string) => string;
  print(node: TreeNode): string;
}
```

### `DefaultTreePrinterService` algorithm

```
print(node):
  lines = [node.label]
  renderChildren(node.children, "", lines)
  return lines.join("\n")

renderChildren(children, prefix, lines):
  for i, child in children:
    isLast = (i === children.length - 1)
    connector = isLast ? "└── " : "├── "
    extension = isLast ? "    " : "│   "
    if child is string:
      lines.push(prefix + connector + child)
    else:
      lines.push(prefix + connector + child.label)
      renderChildren(child.children, prefix + extension, lines)
```

Color: when `colorEnabled`, wrap each `label` (and string child) with
`colorFunction(label, "#color")`. A default hex color for tree node labels
should be defined (e.g. primary: `"#839496"`). This can be a
constructor-injectable color string.

### `TreePrinterServiceProvider`

Mirrors `SyntaxHighlighterServiceProvider` exactly:

- Constructor: `servicePriority: number`, instantiates
  `DefaultTreePrinterService`
- `provide()`: returns `{ commands: [] }`
- `initService(context)`:
  - Gets `PrinterService` from context
  - `this.#defaultTreePrinterService.colorEnabled = printerService.colorEnabled`
  - `this.#defaultTreePrinterService.colorFunction = printerService.color.bind(printerService)`

### `index.ts` additions

```typescript
export { TREE_PRINTER_SERVICE_ID } from "./src/api/service/core/TreePrinterService.ts";
export type { default as TreePrinterService } from "./src/api/service/core/TreePrinterService.ts";
export type { TreeNode } from "./src/api/service/core/TreePrinterService.ts";
export { default as DefaultTreePrinterService } from "./src/service/treePrinter/DefaultTreePrinterService.ts";
export { default as TreePrinterServiceProvider } from "./src/service/treePrinter/TreePrinterServiceProvider.ts";
```

### Tasks - Feature 3

- [x] Create `src/api/service/core/TreePrinterService.ts`
- [x] Create `src/service/treePrinter/DefaultTreePrinterService.ts` with
      recursive box-drawing renderer
- [x] Create `src/service/treePrinter/TreePrinterServiceProvider.ts`
- [x] Add 5 export lines to `index.ts`
- [x] Write `tests/service/treePrinter/DefaultTreePrinterService.test.ts`:
  - Single root, no children -> just the label
  - Root with string children
  - Root with TreeNode children (2-level nesting)
  - Mixed children (strings and nodes at same level)
  - Deep nesting (3+ levels), verify `│` continuation chars
  - Last child uses `└──`, others use `├──`
  - `colorEnabled=true` wraps labels in colorFunction output
  - `colorEnabled=false` returns plain text
- [x] Write `tests/service/treePrinter/TreePrinterServiceProvider.test.ts`:
  - `provide()` returns empty commands array
  - After `initService()`, colorEnabled and colorFunction set from
    PrinterService

---

## Verification

```bash
# Full test suite
bun test

# Lint
deno lint index.ts src/ tests/

# Format check
deno fmt --check
```

Manual checks:

- `DefaultAsciiBannerGeneratorService.generate("HELLO", { subMessage: "My Sub" })` -
  verify double-spaced sub, centered
- `DefaultAsciiBannerGeneratorService.generate("HELLO", { colorEffects: { messageForeground: { type: "rainbow", direction: "horizontal" } } })` -
  verify per-char ANSI codes
- `bgBlue("NX")` on DefaultPrinterService at colorLevel 3 - verify `\x1b[48;2;`
  prefix
- `DefaultTreePrinterService.print({ label: "Root", children: [{ label: "A", children: ["leaf"] }, "B"] })` -
  verify box chars

### Prerequisite

Before implementing `ChiselFontAsciiBannerGeneratorService`, the `chisel.flf`
font file must be sourced and converted to `chisel.flf.json` (same format as
`standard.flf.json`: `{ "font": "<definition>" }`). The file is in the root of
the repo.
