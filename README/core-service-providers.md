# Core Service Providers

The core `ServiceProvider` implementations (and the service and `Command`
implementations they provide) built into the framework are:

## `ArgumentPrompterServiceProvider`

Provides:

- `ArgumentPrompterService` which automatically prompts the user for missing
  mandatory arguments when all parse errors are of type `MISSING_VALUE`. Derives
  the appropriate prompt type from the argument definition: boolean arguments
  become toggle prompts, arguments with allowable values become single select
  prompts, and other arguments become text entry prompts. Handles complex
  options by prompting for each nested property and array/vararg arguments by
  repeating prompts with an "add another?" confirmation.

NOTE: This service is opt-in. Enable via `argumentPrompterEnabled` flag on
`BaseCLI`, `DefaultRuntimeCLI`, or the launcher functions. Requires
`prompterEnabled` to also be true.

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
(from `CLIConfig.subMessage`). If an `UpgradeService` is registered and reports
a newer version available, an additional
`(<latest version> available, run '<cli name> upgrade')` line is shown below
the version.

Provides:

- `NoBannerCommand` allowing banner printing to be disabled via the argument
  `--no-banner` or the env var `NO_BANNER`.

## `CompletionServiceProvider`

Provides:

- `CompletionService` allowing shell auto-completion support for Bash, Zsh,
  Fish, and PowerShell. Completions are dynamic (callback-based) rather than
  static scripts, so they reflect the current set of registered commands
  including dynamically discovered plugins.
- `CompletionGroupCommand` (`completion`) with two sub-commands:
  - `completion:integration` installs shell completion integration by adding a
    bootstrap script to the shell configuration file (e.g. `~/.bashrc`,
    `~/.zshrc`, `~/.config/fish/config.fish`, or the PowerShell profile). Takes
    a required `shell` positional argument and an optional `--config-path`
    option.
  - `completion:complete` generates completions for shell integration. This is
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

## `FetchServiceProvider`

Provides:

- `FetchService` allowing a `Command` to perform a `fetch()` request. Supports the same options as
  native `fetch()` (method, headers, body, etc. via `RequestInit`) plus an optional `timeoutMs` and
  cooperation with `ShutdownService`'s long-running mode (`longRunning: true`) so a single Ctrl-C
  gracefully aborts the request rather than immediately exiting the CLI. A timeout rejects with a
  `DOMException` named `"TimeoutError"`, a shutdown-triggered abort rejects with one named
  `"AbortError"`, and a genuine network failure rejects with a `TypeError` - the same distinction
  native `fetch()` already gives.

NOTE: This service is opt-in. Enable via `fetchServiceEnabled` flag on `BaseCLI`,
`DefaultRuntimeCLI`, or the launcher functions.

## `ImagePrinterServiceProvider`

Provides:

- `ImagePrinterService` allowing rendering of images and animated GIFs in the
  terminal. Images are rendered from a `Uint8Array` buffer with configurable
  width as a percentage of the terminal width. GIF detection is automatic based
  on file magic bytes.

## `PluginServiceProvider`

Provides:

- `PluginService` allowing a `Command` to search for, install, remove and list plugins, and
  check for available plugin updates.
- `PluginGroupCommand` (`plugin`) with sub-commands:
  - `plugin:list` lists locally installed plugins.
  - `plugin:search <query>` searches remote plugins.
  - `plugin:add <pluginId>` installs a plugin.
  - `plugin:remove <pluginId>` removes an installed plugin.
  - `plugin:upgrade` upgrades all installed plugins to their latest versions.
- On initialisation, discovers and registers commands and service providers contributed by
  locally installed CLI plugins.

NOTE: This service is opt-in. Enable via `pluginServiceEnabled` flag (with
`pluginServiceRemoteConfig` and `pluginServiceLocalConfig` supplying the default remote and
local plugin repository configuration) on `BaseCLI`, `DefaultRuntimeCLI`, or the launcher
functions. See [Plugins](plugins.md) for full details on writing and enabling plugin support.

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

NOTE: This service is opt-in. Enable via `prompterEnabled` flag on `BaseCLI`,
`DefaultRuntimeCLI`, or the launcher functions.

## `ShutdownServiceProvider`

Provides:

- `ShutdownService` allowing registration of callbacks for CLI shutdown.

Handles SIGINT (Ctrl-C) and SIGTERM signals:

- **Normal mode** (default): A single SIGINT triggers graceful shutdown (running
  all registered shutdown listeners) then exits with code 130.
- **Long-running mode**: Commands can opt in via `enterLongRunningMode()`. In
  this mode, the first SIGINT sets a cooperative `isShutdownRequested` flag that
  the command can poll. A third SIGINT forces graceful shutdown and exit.
- **SIGTERM**: Always triggers immediate graceful shutdown and exits with
  code 143.

Cooperative cancellation pattern which can be used in a long running command:

```typescript
shutdownService.enterLongRunningMode();
while (!shutdownService.isShutdownRequested) {
  // do work
}
shutdownService.leaveLongRunningMode();
```

## `SpawnServiceProvider`

Provides:

- `SpawnService` allowing a `Command` to spawn a child process. Output can
  optionally be captured line-by-line via a callback (`mode: "wrapped"`)
  instead of being inherited directly by the CLI's stdout/stderr, or discarded
  entirely (`mode: "ignore"`). Shutdown signals are gracefully forwarded to the
  spawned process (SIGTERM, followed by SIGKILL after a grace period if it
  hasn't exited). Cooperates with `ShutdownService`'s long-running mode so a
  single Ctrl-C terminates the spawned process rather than immediately exiting
  the CLI.

NOTE: This service is opt-in. Enable via `spawnServiceEnabled` flag on
`BaseCLI`, `DefaultRuntimeCLI`, or the launcher functions.

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

## `UpgradeServiceProvider`

Provides:

- `UpgradeService` allowing a CLI to check for and install newer versions of
  itself. Detects the current OS (Linux, macOS, Windows) and CPU architecture
  (x64, arm64), and the mechanism by which the CLI was installed (a Linux
  install script backed by GitHub releases, a Homebrew tap, Winget, or manual
  GitHub release download). Determines the latest available version for the
  resolved install method and performs the upgrade via `SpawnService`. Configured by
  the CLI author via an `UpgradeLocationsConfig` describing the supported
  platforms and the release location for each install method.
- `UpgradeSubCommand` (`upgrade`) which checks for and installs the latest
  version. Accepts optional `--os` and `--install-method` arguments to override
  auto-detection.
- On first run, if both `PrompterService` and `KeyValueService` are available,
  prompts the user to enable automatic upgrades on startup. If enabled, every
  subsequent run checks for and installs a newer version automatically before
  the CLI's main command executes.

NOTE: This service is opt-in. Enable via `upgradeServiceEnabled` flag (with
`upgradeLocationsConfig` supplying the release locations) on `BaseCLI`,
`DefaultRuntimeCLI`, or the launcher functions. Requires `FetchServiceProvider`
(`fetchServiceEnabled`) for the version-check/download fetches, and
`SpawnServiceProvider` (`spawnServiceEnabled`) for the install/upgrade step
itself and for the Homebrew/Winget detection and version-check spawns; without
either, upgrade availability can still be partially detected and reported
(e.g. by `VersionCommand`) but not installed.
