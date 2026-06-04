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
- A `ChiselFontAsciiBannerGeneratorService` variant is also provided with a
  built-in "chisel" FIGlet font and support for ANSI color remapping via
  `ChiselBannerColors`.

## `BannerServiceProvider`

On initialisation this uses the `PrinterService` to output the CLI name in ASCII
banner text together with the CLI description, version and optional sub-message
(from `CLIConfig.subMessage`).

Provides:

- `NoBannerCommand` allowing banner printing to be disabled via the argument
  `--no-banner` or the env var `NO_BANNER`.

## `CompletionServiceProvider`

Provides:

- `CompletionService` allowing shell auto-completion support for Bash, Zsh,
  Fish, and PowerShell. Completions are dynamic (callback-based) rather than
  static scripts, so they reflect the current set of registered commands
  including dynamically discovered plugins.
- `CompletionGroupCommand` (`completions`) with two sub-commands:
  - `completions:integration` installs shell completion integration by adding a
    bootstrap script to the shell configuration file (e.g. `~/.bashrc`,
    `~/.zshrc`, `~/.config/fish/config.fish`, or the PowerShell profile). Takes
    a required `shell` positional argument and an optional `--config-path`
    option.
  - `completions:complete` generates completions for shell integration. This is
    invoked by the shell's completion mechanism and returns completions in the
    format expected by that shell.
- On first run, if both `PrompterService` and `KeyValueService` are available,
  prompts the user to enable auto-completion.

NOTE: This service is opt-in. Enable via `completionEnabled` flag on `BaseCLI`,
`DefaultRuntimeCLI`, or the launcher functions.

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

## `PrompterServiceProvider`

Provides:

- `PrompterService` allowing interactive user input via the terminal. Supports
  five prompt types: single select (scrollable list), multi select (checkboxes),
  acknowledge (Yes/No), toggle (True/False), and text entry (with masking for
  secrets). Configurable via `PrompterServiceConfig` for prompt characters,
  checkbox characters, list colors, and scroll window size.
- `NoPromptCommand` which allows interactive prompting to be disabled via the
  argument `--no-prompt` or the env var `NO_PROMPT`.

## `ArgumentPrompterServiceProvider`

Provides:

- `ArgumentPrompterService` which automatically prompts the user for missing
  mandatory arguments when all parse errors are of type `MISSING_VALUE`. Derives
  the appropriate prompt type from the argument definition: boolean arguments
  become toggle prompts, arguments with allowable values become single select
  prompts, and other arguments become text entry prompts. Handles complex
  options by prompting for each nested property and array/vararg arguments by
  repeating prompts with an "add another?" confirmation.

NOTE: Both services are opt-in. Enable via `prompterEnabled` and
`argumentPrompterEnabled` flags on `BaseCLI`, `DefaultRuntimeCLI`, or the
launcher functions. `argumentPrompterEnabled` requires `prompterEnabled`.

## `ShutdownServiceProvider`

Provides:

- `ShutdownService` allowing registration of callbacks for CLI shutdown.

Handles SIGINT (Ctrl-C) and SIGTERM signals:

- **Normal mode** (default): A single SIGINT triggers graceful shutdown (running
  all registered shutdown listeners) then exits with code 130.
- **Long-running mode**: Commands can opt in via `enterLongRunningMode()`. In
  this mode, the first SIGINT sets a cooperative `isShutdownRequested` flag that
  the command can poll. A third SIGINT forces graceful shutdown and exit.
- **SIGTERM**: Always triggers immediate graceful shutdown and exits with code
  143.

Cooperative cancellation pattern which can be used in a long running command:

```typescript
shutdownService.enterLongRunningMode();
while (!shutdownService.isShutdownRequested) {
  // do work
}
shutdownService.leaveLongRunningMode();
```

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
