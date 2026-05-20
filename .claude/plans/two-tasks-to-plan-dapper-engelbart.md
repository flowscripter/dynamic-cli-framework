# Plan: Hyperlinks + Image Printer Service

## Context

Adding two features to the CLI framework:

1. **Hyperlinks** - OSC 8 hyperlink support on the existing PrinterService, with
   a `hyperlinksEnabled` toggle and `NoHyperlinksCommand`
2. **Image Printer** - New standalone service using `terminal-image` to render
   images/GIFs in the terminal

---

## 1. HYPERLINKS

### Files to modify

- `src/service/printer/terminal/Ansi.ts` - Add OSC 8 constants and `hyperlink()`
  function
- `src/api/service/core/PrinterService.ts` - Add `hyperlinksEnabled: boolean`
  property and `hyperlink(text, url): string` method
- `src/service/printer/DefaultPrinterService.ts` - Implement `hyperlinksEnabled`
  state and `hyperlink()` using Ansi constants
- `src/service/printer/PrinterServiceProvider.ts` - Register
  `NoHyperlinksCommand` (priority = servicePriority + 3, highest)

### Files to create

- `src/service/printer/command/NoHyperlinksCommand.ts` - GlobalModifierCommand
  mirroring NoColorCommand pattern

### Implementation details

**Ansi.ts** - Add constants:

```ts
export const OSC = "\x1b]";
export const BEL = "\x07";
export const SEP = ";";

export function hyperlinkStart(url: string): string {
  return `${OSC}8${SEP}${SEP}${url}${BEL}`;
}

export const HYPERLINK_END = `${OSC}8${SEP}${SEP}${BEL}`;
```

**PrinterService.ts** - Add to interface:

```ts
hyperlinksEnabled: boolean;
hyperlink(text: string, url: string): string;
```

**DefaultPrinterService.ts**:

- Add `#hyperlinksEnabled = true` private field
- Add getter/setter for `hyperlinksEnabled`
- Implement `hyperlink(text, url)`: when enabled, wrap text with
  `hyperlinkStart(url) + text + HYPERLINK_END`; when disabled, return `url` only

**NoHyperlinksCommand.ts** - Same pattern as NoColorCommand:

- Name: `no-hyperlinks`
- Boolean argument, default `false`
- Config key: `NO_HYPERLINKS`
- Sets
  `printerServiceProvider.printerService.hyperlinksEnabled = !argumentValue`

**PrinterServiceProvider.ts** - Add NoHyperlinksCommand to commands array at
priority `servicePriority + 3`

### Tests to create/modify

- `tests/service/printer/DefaultPrinterService.test.ts` - Add tests:
  - `hyperlink with hyperlinksEnabled returns OSC 8 wrapped text`
  - `hyperlink with hyperlinksEnabled false returns plain text`
  - `hyperlinksEnabled defaults to true`

### index.ts

No new exports needed (hyperlink is on existing PrinterService interface).

### README.md

Update PrinterServiceProvider section (~line 1230-1245) to mention:

- `NoHyperlinksCommand` via `--no-hyperlinks` or env var `NO_HYPERLINKS`

---

## 2. IMAGE PRINTER SERVICE

### Dependencies

- `bun add terminal-image` (add `terminal-image` to package.json)

### Files to create

- `src/api/service/core/ImagePrinterService.ts` - Service interface
- `src/service/imagePrinter/DefaultImagePrinterService.ts` - Implementation
- `src/service/imagePrinter/ImagePrinterServiceProvider.ts` - Service provider

### Implementation details

**ImagePrinterService.ts**:

```ts
export const IMAGE_PRINTER_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/image-printer-service";

export default interface ImagePrinterService {
  image(imageBuffer: Buffer, widthPercentage?: number): Promise<string>;
}
```

**DefaultImagePrinterService.ts**:

```ts
import terminalImage from "terminal-image";

export default class DefaultImagePrinterService implements ImagePrinterService {
  async image(
    imageBuffer: Buffer,
    widthPercentage: number = 100,
  ): Promise<string> {
    const isGif = imageBuffer.length >= 3 &&
      imageBuffer[0] === 0x47 && // G
      imageBuffer[1] === 0x49 && // I
      imageBuffer[2] === 0x46; // F

    const widthOption = `${widthPercentage}%`;

    if (isGif) {
      return terminalImage.gifBuffer(imageBuffer, { width: widthOption });
    }
    return terminalImage.buffer(imageBuffer, { width: widthOption });
  }
}
```

GIF detection: check first 3 bytes for "GIF" magic (0x47, 0x49, 0x46) which
covers both GIF87a and GIF89a.

**ImagePrinterServiceProvider.ts** - Follow PrettyPrinterServiceProvider pattern
(simple, no commands, no deps):

```ts
export default class ImagePrinterServiceProvider implements ServiceProvider {
  readonly serviceId = IMAGE_PRINTER_SERVICE_ID;
  constructor(readonly servicePriority: number) { ... }
  provide(): { service, commands: [] }
  initService(): Promise<void> { return Promise.resolve(undefined); }
}
```

### Tests to create

- `tests/service/imagePrinter/DefaultImagePrinterService.test.ts`:
  - Test with a minimal valid PNG buffer (returns a string)
  - Test with a GIF-prefixed buffer (exercises the GIF branch)
  - Test widthPercentage parameter defaults to 100

Note: These tests will call the real `terminal-image` library. We'll use minimal
valid image buffers.

- `tests/service/imagePrinter/ImagePrinterServiceProvider.test.ts`:
  - Test that `provide()` returns service with empty commands array

### index.ts

Add exports:

```ts
export { IMAGE_PRINTER_SERVICE_ID } from "./src/api/service/core/ImagePrinterService.ts";
export type { default as ImagePrinterService } from "./src/api/service/core/ImagePrinterService.ts";
export { default as DefaultImagePrinterService } from "./src/service/imagePrinter/DefaultImagePrinterService.ts";
export { default as ImagePrinterServiceProvider } from "./src/service/imagePrinter/ImagePrinterServiceProvider.ts";
```

### README.md

Add new section after TreePrinterServiceProvider (~line 1274):

```
#### `ImagePrinterServiceProvider`

Provides:

- `ImagePrinterService` allowing rendering of images and animated GIFs in the
  terminal using [terminal-image](https://github.com/sindresorhus/terminal-image).
  Images are rendered from a `Buffer` with configurable width as a percentage of
  the terminal width. GIF detection is automatic based on file magic bytes.
```

---

## Verification

1. `bun install` - install new `terminal-image` dependency
2. `bun test` - run full test suite
3. `deno lint index.ts src/ tests/` - lint check
4. `deno fmt` - format check
