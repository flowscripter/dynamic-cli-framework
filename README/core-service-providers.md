# Core Service Providers

The core `ServiceProvider` implementations (and the service and `Command`
implementations they provide) built into the framework are:

## `AsciiBannerGeneratorServiceProvider`

Provides:

- `AsciiBannerGeneratorService` allowing messages to be rendered using ASCII
  banner [FIGlet](http://www.figlet.org) fonts. The FIGlet "standard" font is
  provided by default and other fonts can be added on demand by commands.
  Supports color effects (fixed, gradient, rainbow) applied independently to the
  message foreground, sub-message foreground and background in both horizontal
  and vertical directions.
- A `ChiselFontAsciiBannerGeneratorService` variant is
  also provided with a built-in "chisel" FIGlet font and support for ANSI color
  remapping via `ChiselBannerColors`.

## `BannerServiceProvider`

On initialisation this uses the `PrinterService` to output the CLI name in ASCII
banner text together with the CLI description, version and optional sub-message
(from `CLIConfig.subMessage`).

Provides:

- `NoBannerCommand` allowing banner printing to be disabled via the argument
  `--no-banner` or the env var `NO_BANNER`.

## `ConfigurationServiceProvider`

Provides:

- `KeyValueService` allowing the storage and retrieval of key value pairs scoped
  to the current `Command` or service being executed. The values are persisted
  to the CLI configuration file.
- `ConfigCommand` allowing the default location of the configuration file to be
  overridden via the argument `--config` or the env var `CONFIG_LOCATION`.
- `DumpConfigCommand` a global command which dumps the full CLI configuration to
  stdout via `--dump-config`.

## `DataDumpGeneratorServiceProvider`

Provides:

- `DataDumpGeneratorService` allowing rendering of binary data as a hex dump or
  ASCII dump. Supports configurable bytes per group, groups per row, spacing
  between groups, and byte-range-based color schemes for visual differentiation
  of byte value ranges.

## `ImagePrinterServiceProvider`

Provides:

- `ImagePrinterService` allowing rendering of images and animated GIFs in the
  terminal. Images are rendered from a `Uint8Array` buffer with configurable
  width as a percentage of the terminal width. GIF detection is automatic based
  on file magic bytes.

## `PrettyPrinterServiceProvider`

Provides:

- `PrettyPrinterService` allowing pretty printing of structured data and source
  code. JSON pretty printing is provided by default and other data or language
  formats can be added on demand by commands.

## `PrinterServiceProvider`

Provides:

- `DefaultPrinterService` allowing foreground and background color output to
  stdout, stderr, management of log levels and widgets such as a spinner and
  progress bars. Background colors include theme-based variants (primary,
  secondary, emphasised, selected) and named colors (yellow, orange, red,
  magenta, violet, blue, cyan, green) as well as arbitrary hex colors. Printing
  hyperlinks is supported.
- `DarkModeCommand` which allows dark or light mode to be enabled via the
  argument `--dark-mode` or the env var `DARK_MODE`.
- `NoColorCommand` which allows color output to be disabled via the argument
  `--no-color` or the env var `NO_COLOR`.
- `NoHyperlinksCommand` which allows hyperlink output to be disabled via the
  argument `--no-hyperlinks` or the env var `NO_HYPERLINKS`.
- `LogLevelCommand` which allows the log level to be set via the argument
  `--log-level` or the env var `LOG_LEVEL`.

## `ShutdownServiceProvider`

Provides:

- `ShutdownService` allowing registration of callbacks for CLI shutdown.

## `SyntaxHighlighterServiceProvider`

Provides:

- `SyntaxHighlighterService` allowing ANSI based color highlighting of
  structured data and source code. JSON highlighting is provided by default and
  other data or language formats can be added on demand by commands.

Note that the `SyntaxHighlighterService` has no effect if the
`DefaultPrinterService` is configured to disable color output.

## `TableGeneratorServiceProvider`

Provides:

- `TableGeneratorService` allowing rendering of tabular data using Unicode
  box-drawing characters. Tables are defined using a `Table` class with
  configurable rows, columns, and cells. Supports column flex-weight layout (CSS
  flex-grow/shrink semantics), per-column/row/cell alignment (left, center,
  right), configurable border colors, cell padding, and automatic word-wrapping
  of cell contents. String width measurement uses `Bun.stringWidth` for correct
  handling of CJK characters and emoji.

NOTE: This service is automatically registered by `BaseCLI` with priority 70 and
is used internally for help text rendering with proper column wrapping.

## `TreePrinterServiceProvider`

Provides:

- `TreePrinterService` allowing rendering of tree structures using Unicode
  box-drawing characters. Trees are defined using `TreeNode` objects with a
  `label` and optional `children` (which can be nested `TreeNode` objects or
  plain strings). Node labels are colored using the `PrinterService`.
