# dynamic-cli-framework

## Project Identity

- **Package**: `@flowscripter/dynamic-cli-framework` v1.1.6 (MIT)
- **Purpose**: Framework for building CLI applications with dynamic discovery
  and installation of new commands
- **Runtime**: Bun (ES modules, TypeScript, no separate build step)
- **Entry point**: `index.ts` (exports all public API)

## Commands

- `bun install` - install dependencies
- `bun test` - run all tests
- `deno fmt` / `deno lint index.ts src/ tests/` - still work if Deno is
  installed, but the repo migrated to oxc tooling (see commit "move to
  oxfmt and oxlint"); prefer:
  - `npx oxfmt --check index.ts src/ tests/` (drop `--check` to auto-fix)
  - `npx oxlint index.ts src/ tests/`
  - No `.oxfmtrc.json`/`.oxlintrc.json` config file exists - both run with
    defaults. `deno fmt`'s default line width (80) reformats files far more
    aggressively than the style already committed in the repo (~100-120
    col lines, single-line imports) - do not run `deno fmt` on the whole
    tree, it produces large, unrelated-looking diffs. `oxfmt --check`
    matches the existing committed style with no diff.

## API Package Split

Pure interface/type declarations (`PrinterService`, `CLI`, `Command`, `ServiceProvider`,
`Context`, `RunResult`, `CLIConfig`, etc. - previously under `src/api/`) now live in the
sibling repo `../dynamic-cli-framework-api`, imported here as
`@flowscripter/dynamic-cli-framework-api`. `Terminal`, `Styler`, `KeyReader` and their
`Tty*`/`NonTty*` implementations were NOT extracted - they remain local under
`src/terminal/`. `BaseCLIFeatureOptions` moved from `src/api/` to `src/cli/` (still local).

Public interface changes land in `dynamic-cli-framework-api` first (separate
PR/release in that sibling repo), then get consumed here. Between the API PR
merging and this repo's `@flowscripter/dynamic-cli-framework-api` dependency
being bumped to the new published version, a concrete implementation class
(e.g. `DefaultPrinterService`) can still implement the new method ahead of
time - TypeScript structural typing allows "extra" methods on a class that
aren't yet part of the imported interface type, so `tsc --noEmit` passes -
but it won't formally satisfy the interface type until the dependency bump
lands (example: `dim()` added to `PrinterService` in
`dynamic-cli-framework-api#11`, implemented here in PR #152 ahead of the
`^2.0.0` -> next version dependency bump).

## Directory Layout

```
index.ts          - Public entry point / all exports
src/
  terminal/       - Terminal abstractions (Ansi, Terminal, TtyTerminal, NonTtyTerminal, Styler, TtyStyler, ImageRenderer, PngDecoder)
  cli/            - BaseCLI, DefaultRuntimeCLI (Node/Bun runtime), BaseCLIFeatureOptions
  command/        - Built-in commands: HelpCommand, VersionCommand, UsageCommand
  runtime/        - Execution engine
    registry/     - CommandRegistry, ServiceProviderRegistry
    parser.ts     - Argument parsing
    scanner.ts    - Command detection from argv
    runner.ts     - Main orchestrator (~707 lines, execution heart)
    values/       - Value population, merging, validation
  service/        - Built-in service implementations (printer, configuration, keyValue, shutdown, startup, etc.)
  startup/banner/ - Banner StartupTask (createBannerStartupTask) - not a ServiceProvider
  launcher.ts     - launchSingleCommandCLI() / launchMultiCommandCLI() convenience functions
  util/           - logger, envVarHelper, configHelper, helpHelper, runnerHelper
tests/            - Mirrors src/ structure; uses bun:test
  fixtures/       - StreamString mock, CLI/Command builders, custom assertions
.github/workflows/ - CI via shared reusable workflows in flowscripter/.github@v1
```

## Architecture

### Command Types

- `GlobalCommand` - single optional argument, runs standalone
- `GlobalModifierCommand` - priority-ordered, runs before the main command
- `SubCommand` - options + positionals, the typical command type
- `GroupCommand` - container grouping member SubCommands

### Service Provider Pattern

Implement `ServiceProvider` to supply services and commands. `servicePriority`
controls initialization order (higher = first).

### Execution Pipeline (runner.ts)

Every registered `ServiceProvider`'s `initService()` call is wrapped as a
`StartupTask` (`toProviderStartupTask()`) and merged, in priority order, with
any directly-registered `StartupTask`s (e.g. the banner task from
`createBannerStartupTask`, registered via `BaseCLI.addStartupTask`/the
`startupTasks` launcher parameter) into one sequence.

1. For each `StartupTask` (by priority): scan/parse/execute its
   GlobalModifierCommands, then run the task - awaited if `mode` is
   `"blocking"` (the default; every ServiceProvider's `initService()` behaves
   this way), fired without awaiting if `"background"` (errors logged, not
   propagated)
2. Execute any remaining GlobalModifierCommands (not provided by a StartupTask)
3. Scan/parse/execute one main command (or fallback to default command)
4. Return `RunResult` with `runState`, `command`, `invalidArguments`, or `error`

`StartupService`/`StartupTask` (in `dynamic-cli-framework-api`) mirror
`ShutdownService`/`ShutdownTask`'s shape: `registerTask({id, priority, run})`.
`StartupTask` additionally has `mode: "blocking" | "background"` and optional
`modifierCommands`. `BaseCLI` owns one `StartupServiceProvider` (priority 95,
a no-op `initService()`) whose `startupService.registerTask()` backs
`addStartupTask()`.

### Context

Holds `CLIConfig` and initialized service instances. Commands call
`context.getServiceById()` to access services.

### Interactive Prompting

`keyReader: KeyReader | undefined` is an optional parameter for `BaseCLI`.
`DefaultRuntimeCLI` only constructs a `TtyKeyReader(process.stdin)` when
`process.stdin.isTTY`; otherwise it passes `undefined`. Prompting requires
both a `keyReader` AND a TTY stderr `Terminal` (prompts read keys from stdin
but render via stderr) - `DefaultRuntimeCLI` computes its `promptingEnabled`
default as `stdin.isTTY && stderr.isTTY`. If `keyReader` is unavailable,
`BaseCLI.run()` simply skips registering `PrompterServiceProvider` (and
`ArgumentPrompterServiceProvider`, if enabled) rather than constructing a
non-functional one - matches the existing pattern where `PrompterService` is
treated as an optional, guarded dependency everywhere it's consumed
(`CompletionServiceProvider`, `runner.ts`'s `ArgumentPrompterService`
interception via `doesServiceExist`). If `promptingEnabled` is explicitly
forced `true` without a usable `keyReader`/TTY stderr, `BaseCLI.run()` throws
immediately rather than failing later inside a prompt.

`ArgumentPrompterService` (opt-in via `argumentPrompterServiceEnabled` in
`BaseCLIFeatureOptions`) intercepts MISSING_VALUE parse errors in runner.ts
and prompts the user, then re-assembles the ParseResult.

### Non-TTY / Piped Mode

`DefaultRuntimeCLI` detects `stdin`/`stdout`/`stderr` TTY-ness independently
and degrades gracefully instead of crashing (previously `TtyTerminal`/
`TtyKeyReader` would throw immediately if given a non-TTY stream):

- Non-TTY `stdout`/`stderr` are wrapped in `NonTtyTerminal` instead of
  `TtyTerminal`. `NonTtyTerminal.write()`/`columns()`/`rows()` work (the
  latter two returning the same 80/24 defaults `TtyTerminal` falls back to);
  `clearLine()`/`clearUpLines()`/`hideCursor()`/`showCursor()` reject.
- `TtyStyler` colorLevel is forced to `0` (no color) when stderr is not a
  TTY, regardless of what `supports-color` reports.
- Prompting and `ImagePrinterServiceProvider` are unavailable (see above and
  `ImagePrinterServiceProvider` registration in `BaseCLI.run()`, gated on
  `stdoutTerminal.isTty()`).
- `PrinterService.showSpinner()`/`showProgressBar()` no-op when stderr is
  not a TTY (`showProgressBar()` still returns `-1`, matching its existing
  level-filtered sentinel).
- `startQuote()`/`endQuote()` are stderr-only (no longer affect `print()`/
  stdout) and keep applying their indent prefixes even when stderr is
  piped - it's just text transformation. `startMark()`/`endMark()`/
  `clearMarked()` are also stderr-only and become a no-op (no
  `clearUpLines()` call, no `minimumDisplayTimeMs` wait) when stderr is not
  a TTY, since erasing rows is impossible without a real screen - but still
  throw on mismatched start/end call sequencing regardless of TTY-ness.
  Known limitation: using `print()` (stdout) inside a marked stderr section
  is unsupported if both streams render to the same physical terminal
  (interleaved output can't be cleanly erased since mark only tracks stderr
  rows).
- Every forced-enable/disable decision logs via `getLogger(...).debug(...)`
  (gated by `DYNAMIC_CLI_FRAMEWORK_DEBUG=true`), so it's possible to see why
  prompting/images/spinners/etc were suppressed at runtime.

### Shell Auto-Completion (opt-in)

Enable via `completionServiceEnabled` in `BaseCLIFeatureOptions` on BaseCLI,
DefaultRuntimeCLI, or launcher functions. Supports Bash, Zsh, Fish, and PowerShell. Completions are dynamic
(callback-based) via `completion:complete` sub-command. Integration is
installed via `completion:integration` sub-command. The completion commands
live in `src/service/completion/command/` and are returned from
`CompletionServiceProvider.getServiceInfo()`, which receives a `CommandRegistry`
via constructor injection (mirrors `DefaultPluginServiceProvider`). Shell-specific
handlers are in `src/service/completion/shell/`.

### Signal Handling

ShutdownServiceProvider registers SIGINT and SIGTERM handlers. Normal mode:
single Ctrl-C triggers graceful shutdown (exit 130). Long-running mode
(opt-in via `enterLongRunningMode()`): first Ctrl-C sets cooperative
`isShutdownRequested` flag; third Ctrl-C forces exit. SIGTERM always triggers
graceful shutdown (exit 143). In raw-mode (prompts), Ctrl-C (0x03) is mapped
to `SpecialKey.INTERRUPT` and bridges to `ShutdownServiceProvider.onInterrupt()`.
Shared state lives in `src/service/shutdown/ShutdownState.ts`.

### Configuration Injection

Commands with `enableConfiguration: true` receive defaults from env vars /
config files via `ConfigurationServiceProvider`.

The default config file location is resolved in
`DefaultConfigurationService.init()` as `process.env.HOME || os.homedir()`.
`$HOME` is read first because tests point it at a temp dir and Bun caches
`os.homedir()` (it ignores later `HOME` changes). The `os.homedir()` fallback
is what makes Windows work, where `HOME` is normally unset (`%USERPROFILE%`).
Without a location, key-value writes at shutdown (e.g. the auto-upgrade
preference) fail with "Attempt to write updated config with no configLocation set".

### Secret Storage

`KeyValueService` supports OS-native secret storage via Bun.secrets API.
Set `secretServiceEnabled=true` on `KeyValueServiceProvider` (requires
`configEnabled=true` on `ConfigurationServiceProvider`, which it takes a
direct constructor reference to). Wrap any node of a value passed to
`KeyValueService.set()` in `Secret` to have that node stored as an OS-native
secret - a `__SECRET__:<bun_secret_name>` sentinel is substituted in its
place in the config file, and `KeyValueService.get()` resolves any such
sentinel (at any depth) back to its OS-stored value. `DefaultSecretService`
accepts an optional `SecretsApi` parameter for dependency injection in tests
(defaults to `Bun.secrets`).

Note: `KeyValueService` methods are async (return Promises).

## `plugin:add` Installed-Version Message (#165)

`PluginAddSubCommand`'s final success message now shows the real installed
version (`Plugin @scope/name@1.2.3 installed.`) instead of omitting it.
`descriptor.version` at the point `install()` is called is only trustworthy
when the version was explicitly requested (`:version` suffix, parsed by
`parsePluginSpecifier`) or the plugin was found via `search()` (which always
returns the real latest version, not the literal tag) - the direct-install
fallback branch (search found no match) leaves `descriptor.version` as the
literal placeholder string `"latest"` when no version was requested.
`PluginService.install()` returns `void` and neither it nor
`checkAvailable()` surface a resolved version, so no `dynamic-cli-framework-api`/
`dynamic-plugin-framework` change was needed: after `install()` completes,
`PluginAddSubCommand` now calls `pluginService.listInstalled()` (backed by
`NpmPluginRepository` reading `node_modules` package.json) and looks up the
matching `pluginId` to get its real installed version for the message -
works uniformly for both the search-found and direct-install-fallback paths.
`PluginAddSubCommand.test.ts`'s `buildContext()` helper now also returns
`dummyStdout` (previously only `dummyStderr`) since the final "installed"
message is written via `printerService.print()` (stdout), while the
"Searching"/"Installing" progress messages use `printerService.info()`
(stderr) - easy to mix these up when asserting message content.

## Key Interfaces (src/api/)

- `CLI` - `run(args, config): RunResult`
- `Command` / `SubCommand` / `GlobalCommand` / `GlobalModifierCommand` /
  `GroupCommand`
- `Argument` / `Option` / `Positional` / `ComplexOption`
- `ServiceProvider` / `Context`
- `RunResult` / `RunState` / `InvalidArgument` / `InvalidArgumentReason`

## Built-in Services

| Service                          | Priority | Purpose                                                                                     |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| ShutdownServiceProvider          | 100      | Graceful shutdown hooks                                                                     |
| StartupServiceProvider           | 95       | No-op host for registered StartupTasks (banner, upgrade-check, etc.), run in priority order |
| ConfigurationServiceProvider     | 90       | Env var + config file defaults (+ secret resolution for defaults)                           |
| KeyValueServiceProvider          | 89       | Key-value store + secrets, backed by ConfigurationServiceProvider's config file             |
| PrinterServiceProvider           | 80       | Colored stdout/stderr, spinners, progress                                                   |
| PrompterServiceProvider          | 75       | Interactive user input prompting (opt-in)                                                   |
| TableGeneratorServiceProvider    | 70       | Table rendering with flex layout                                                            |
| ArgumentPrompterServiceProvider  | 65       | Auto-prompt for missing arguments (opt-in)                                                  |
| CompletionServiceProvider        | 60       | Shell auto-completion (opt-in)                                                              |
| SyntaxHighlighterServiceProvider | -        | Code syntax highlighting                                                                    |
| PrettyPrinterServiceProvider     | -        | JSON/object pretty printing                                                                 |
| DataDumpGeneratorServiceProvider | -        | Hex/ASCII binary data dumps                                                                 |

Banner output is a `StartupTask` (`createBannerStartupTask`), not a
`ServiceProvider` - it is not in the table above; it is registered via the
`startupTasks` launcher parameter or `BaseCLI.addStartupTask`.

## Worktrees

New `git worktree add` checkouts do not carry over `node_modules` - run
`bun install` inside the worktree before `bun test` (without it, bun test
resolves modules from whatever repo the shell's cwd happens to be in,
producing confusing "export not found" errors unrelated to the change
being tested).

When resuming a long-lived agent worktree whose branch already merged (PR
squash-merged, release cut), the branch's single commit will have zero diff
against `origin/main` - `git reset --hard origin/main` onto the branch and
continue from there. The remote branch is typically auto-deleted after a
squash merge, so `git push --force-with-lease` fails with "stale info" /
"couldn't find remote ref" in that case; a plain `git push -u origin
<branch>` recreates it. `gh pr list --head <branch>` correctly shows no open
PR once this has happened - open a fresh one rather than expecting to update
the old (now-merged) PR number.

## Plugin Registry Existence Checks

`checkAvailable(pluginId, version?): Promise<boolean>` is now a real,
published method on both `PluginService` (`dynamic-cli-framework-api@2.3.0`)
and `MarketplacePluginManager` (`dynamic-plugin-framework@2.2.0`) - the
earlier duck-typed `assertPluginAvailable` workaround (a bespoke direct
npm-registry HTTP lookup on `DefaultPluginService`, detected via a `typeof`
guard in `PluginAddSubCommand`) was rejected by the user and removed
entirely (PR #161, superseding the closed #160). `checkAvailable` is
implemented generically in `BaseMarketplacePluginManager` (in
`dynamic-plugin-framework`) via each remote's `getPlugin()` - a targeted
lookup, not the fuzzy/ranked `search()` - so it still respects the "is this
a valid plugin" semantics (`packageJsonNamespace` keyword +
non-empty `extensionPoints`), not just "does this package exist".
`DefaultPluginService.checkAvailable()` simply delegates to
`pluginManager.checkAvailable()`. `PluginAddSubCommand` calls
`pluginService.checkAvailable(pluginId, version)` directly (skipping the
version arg when the resolved version is `"latest"`, matching npm dist-tag
semantics) and throws its own clear error from the boolean result before
handing off to `install()`. `DefaultPluginService.setFetch()` only forwards
to the underlying `pluginManager` now (no more local `#fetchFn`/
`#remoteConfigs` bookkeeping for the removed bespoke lookup).

## Resolved: Mark/Clear Artifacts on `plugin:add` (#147 follow-up)

Reporter (vectronic) supplied two raw `script` captures (read with `cat -v` /
byte-level parsing, not a text-rendering tool, to see the actual
`\x1b[1A\x1b[2K...` sequences):

- A successful install where the clear erased far more than the spawned
  block - exactly 2x the actual physical output lines (verified via raw byte
  analysis: 11 real `bun add` output lines, but `\x1b[1A\x1b[2K` appeared 22
  times, and `Quote`'s `│` prefix rendered as if two quote levels were
  active instead of one, from the second spawned line onward).
- A failed install where the diagnostic output was still cleared, even
  though it should stay on screen per #150's original fix.

Both symptoms were already fixed on `main` by PR #153 ("fix: don't clear
spawned quoted output on error", merged after the captures' example-cli
build but before this investigation) - `SpawnInterfaceAdapter` calls
`discardMark()` (not `clearMarked()`) on failure, and `DefaultSpawnService`
now awaits both `pipeStdout`/`pipeStderr` before returning so `clearMarked()`
can never compute a row count from partially-delivered output. Added
integration-level regression tests
(`tests/service/plugin/SpawnInterfaceAdapter.test.ts`) that exercise the
_real_ `DefaultPrinterService` + `DefaultSpawnService` + `SpawnInterfaceAdapter`
together (previous tests only used hand-written fakes for
`PrinterService`/`SpawnService`, which couldn't have caught a genuine
row-count miscount): one asserts a real multi-line spawn only erases its own
lines (banner text written beforehand survives byte-for-byte), the other
asserts a failed spawn leaves its output on screen and doesn't corrupt mark
bookkeeping for the next `spawn()` call.

Also tried to reproduce the 2x-clear symptom directly against `main` using
the exact same production classes and the exact real npm package from the
report (`@flowscripter/example-cli-plugin`) - it installed cleanly with
correct single-level quoting and exactly-matching row counts every time.
Best explanation: the captures were taken against example-cli's currently
_installed_ (older, pre-#153) framework dependency - consistent with this
fix not yet having been released to npm at the time of the report.

**This "couldn't reproduce" conclusion was wrong** - the real bug was still
present and needed color enabled to trigger (see below). The above repro
attempt evidently ran with colors disabled or in a context where
`colorText()` was a no-op, which happens to sidestep the actual defect.

## Resolved: Mark/Clear Erasing Into the Banner on `plugin:add` Success, Color-Enabled (#150 recurrence)

Reporter recurrence on `example-cli@1.8.6` (which _does_ include #153's
fix): on a **successful** `plugin:add`, the clear still erased into the
banner printed at startup (missing the banner's last figlet line plus the
`subMessage`/`version` lines). This is a different bug from the #153/#147
one above - same visible symptom class (over-erasure), different root
cause, and it only reproduces with **color enabled** on a real TTY, which
is why the prior investigation's repro (color off / non-interactive) missed
it despite using the same real production classes.

Root cause: `TtyStyler.colorText()`/`italicText()`/etc. wrap the _entire_
passed-in string - including a trailing `"\n"`, when the caller's message
already ends with one - with the ANSI reset sequence appended _after_ that
newline, e.g. `"foo\n"` becomes `"<color>foo\n<reset>"`. Two places counted
physical lines by checking `message.endsWith("\n")` on text that had
already been through this styling:

- `DefaultPrinterService#countLines()` (used by `#recordMarkedWrite()` to
  grow `#markedLineCount`) - since the styled string never actually ends
  with `"\n"` (it ends with the reset code), the `- 1` correction never
  fires and every colored marked write with a trailing newline is
  over-counted by one row. Summed across an 11-line spawned `bun add`
  block, `#markedLineCount` reached 22 - `clearMarked()` then issued 22
  `\x1b[1A\x1b[2K` erases for an 11-row block, eating two rows out of the
  banner above it.
- `Quote.prefixLines()` had the identical `endsWith("\n")` check and the
  same defeat - it split the trailing reset sequence off as a bogus extra
  "line" and gave it its own quote prefix, which is the mechanism behind
  the historical "doubled `│` prefix, as if two quote levels were active"
  symptom - that symptom was never actually fixed by #153, it just wasn't
  re-tested with color enabled afterwards.

Confirmed via real repro: linked this repo's `HEAD` into the real
`example-cli` checkout (`bun link`), drove `plugin:add
@flowscripter/example-cli-plugin@3.0.0` through a Python-driven pty (`os.pty`)
at 80 columns (auto-confirming the upgrade/completion first-run prompts with
`\r`), and parsed the raw byte stream for `\x1b[1A\x1b[2K` counts rather than
eyeballing rendered output - 22 erases for 11 real physical rows, banner's
last two lines missing after the clear, `"│ │ "` doubled quote prefix on
every spawned line. Fixed both `#countLines()` and `Quote.prefixLines()` to
strip ANSI CSI escape sequences before doing the `endsWith("\n")`/line-count
logic (in `Quote.prefixLines()`, the trailing sequence is stripped, the real
content is prefixed, then the trailing sequence is restored so the ANSI
reset still gets emitted). Re-ran the same real repro after the fix: exactly
11 erases, banner intact byte-for-byte, single `│` prefix. Added a new
integration test in `tests/service/plugin/SpawnInterfaceAdapter.test.ts`
("...with color enabled, clears exactly the spawned block's rows...") using
the real `DefaultPrinterService`/`DefaultSpawnService`/`SpawnInterfaceAdapter`
with color **enabled** (the existing integration tests in that file set
`printerService.colorEnabled = false`, which is exactly why they didn't
catch this) - asserts a colored banner printed beforehand survives
byte-for-byte and the erase count exactly matches the spawned block's own
line count. Fixed in PR #170.

**Lesson for future mark/clear investigations in this codebase**: always
test with color enabled _and_ disabled - `colorText()` being a no-op when
colors are off silently disables an entire class of line-counting bugs.

## Inconclusive: `plugin:add` Hang Hypothesis (#147, third investigation round)

Reporter hypothesized the hang (reproduces on a real interactive TTY, not
under `script`) is a first-run race tied to `~/.example-cli` or
`~/.examplecli.json` not existing yet. Checked:

- `ConfigurationServiceProvider.initService()`/`#readConfig()`/`#writeConfig()`
  (`src/service/configuration/ConfigurationServiceProvider.ts`): all
  filesystem access is `node:fs/promises` (`lstat`, `readFile`, `writeFile`) -
  no sync fs calls that could block the event loop. A missing default config
  file (`isDefault` true) is caught and swallowed via `logger.debug(...)`
  then `return` - no retry loop, no blocking wait. `src/util/configHelper.ts`
  only computes configuration _key names_, no file I/O at all.
- No code path in this repo references a `~/.example-cli` _directory_
  specifically - the closest analog is the plugin `NpmPluginRepository`'s
  `nodeModulesPath`, created via `await mkdir(cwd, { recursive: true })` in
  `dynamic-plugin-framework`'s `NpmPluginManager.installOne()` (async,
  awaited, no sync call).
- `DefaultRuntimeCLI`'s prompting gate (`stdin.isTTY && stderr.isTTY`, see
  "Interactive Prompting" above) reads `process.stdin.isTTY` etc. directly -
  `script` wraps stdin/stdout/stderr in a real pty, so `isTTY` reads `true`
  under `script` too. Nothing in `src/service/prompter/` or
  `DefaultRuntimeCLI.ts`/`BaseCLI.ts` branches differently based on
  `script`-wrapped vs. bare pty - the TTY detection is identical in both
  cases as far as this codebase can tell.

No concrete reproducible root cause found. This is the third unsuccessful
investigation round for this hang - if it recurs, capturing `kill -QUIT
<pid>` output (Bun stack dump) or `strace -f` from a genuinely hung live
session would narrow it down far more directly than further static review.

## Testing

- Framework: `bun:test` (`describe`, `test`, `expect`)
- Fixtures in `tests/fixtures/`: `StreamString` (stdout/stderr mock), command
  builders, `expectStringIncludes`/`expectStringEquals`
- Run with: `bun test`

## Environment Variables

- `DYNAMIC_CLI_FRAMEWORK_DEBUG=true` - enable framework debug logging
- `DYNAMIC_CLI_FRAMEWORK_VALIDATE_ALL=true` - enable command/service validation
  on startup

## Dependencies

- `figlet` - ASCII banner generation
- `highlight.js` + `emphasize` - syntax highlighting
- `prettier` - pretty printing structured data
- `fastest-levenshtein` - fuzzy command name matching
- `supports-color` - terminal color detection
- `supports-terminal-graphics` - terminal graphics protocol detection (Kitty, iTerm2, Sixel)
- Peer: `typescript ^6.0.3`

## Restart After Automatic Upgrade

- `BaseCLIFeatureOptions.restartAfterAutoUpgrade` (off in `BaseCLI`, on in `DefaultRuntimeCLI`):
  after a successful auto-upgrade, `UpgradeServiceProvider` flushes KV (`KeyValueService.flush()`),
  then calls `DefaultUpgradeService.restart(executable, args)`. That runs the upgraded binary
  through `SpawnService` (inherit mode, `longRunning: true`, env
  `DYNAMIC_CLI_FRAMEWORK_REEXEC_FROM=<old version>`).
- The auto-upgrade task returns `{ exitRequest: { runState } }`. `runner.ts` then returns a
  `RunnerResult` with `exitRequested: true`, and `BaseCLI` returns `{ runState }` without
  printing usage or help.
- In the child, `UpgradeService.restartedFromVersion` is set, so the banner and the auto-upgrade
  task skip themselves.
- Args reach the provider only through `UpgradeServiceProvider.setRestartArgs()`, called from
  `BaseCLI.run()`, never through `StartupTaskContext`.
- Bun reports a signal-killed child's exit code as 128 + signal (SIGINT 130, SIGTERM 143, SIGKILL
  137). `toRunState()` relies on this.
- `validate-bun-library-pr` (the cross-platform tests) only runs on PRs targeting `main`. A PR
  stacked on another branch only gets `lint-pr-message` until it's retargeted.

## Tree Shaking Conventions

- `package.json` declares `"sideEffects": false` (dcf#226, dpf#126). Keep modules free of
  load-time work (no top-level `process.on`, registrations or global patches); do such work in
  constructors or functions.
- Optional services stay wired in `BaseCLI` via the `*ServiceEnabled` flags. Nick rejected
  `optionalServices` factories as too complex for the tree-shaking gain (reverted on dcf#226;
  issue #223 left open pending his decision). Don't re-propose that pattern.
- `DefaultPrettyPrinterService` uses `prettier/standalone` with only the babel + estree plugins
  (JSON only); other syntaxes come via `registerSyntax()` (issue #222). Prettier has no
  JSON-only plugin (JSON parsers live in babel, JSON printer in estree). `JSON.stringify` is
  lossy (key order, number form, layout); offered to Nick on dcf#226, not adopted unless he asks.
- Platform checks: compare `process.platform` / `process.arch` directly in `if` conditions so
  `bun build --compile` drops other-platform branches. Don't alias them to a variable, don't use
  `switch` or `os.platform()`, and never detect the platform in a Bun macro (it returns the build
  host). Tests stub `process.platform` with `Object.defineProperty` (issue #225, PR #227).
- `subCommandValuePopulation` caches nested complex-option lookup maps by the full path of
  enclosing option names (`command.properties.file`); before PR #228 it keyed by the parent name
  only, so same-named nested options under different parents collided.

## Upgrade Service Overrides

- `UpgradeService.checkForUpgrade()` / `upgrade()` take only an optional `installMethod` override (api 5.0.0+, PR #229); OS and arch are always detected. The `upgrade` command has `--install-method` but no `--os`.
- Tests that need a specific OS/arch stub `process.platform` / `process.arch` via the `withHost(platform, arch, fn)` helper in `tests/service/upgrade/DefaultUpgradeService.test.ts`.
- To verify a change against an unreleased api PR locally: `bun install`, then copy the api worktree's `src/`, `dist/` (after `bun run build`) and `index.ts` over `node_modules/@flowscripter/dynamic-cli-framework-api/`.

## Theme Option

`ThemeCommand` (`--theme auto|dark|light`, env `THEME`, default `auto`) replaced `DarkModeCommand`/`--dark-mode`. `auto` uses `src/terminal/BackgroundDetector.ts` (COLORFGBG, then OSC 11 + DA1 query on an interactive TTY, 150ms timeout) and falls back to dark. It runs after `NoColorCommand` (priorities +1 and +2 respectively) so detection is skipped when color is disabled.

## Config Get/Set/Unset

`config:get|set|unset` (members of the `config` group, with `config:dump`) are built by
`ConfigurationServiceProvider` only when it is given the `CommandRegistry` (6th constructor arg, passed by
`BaseCLI`; 7th is an optional `SecretsApi` for tests). Shared target/path/mask logic is in
`src/service/configuration/configTargets.ts`. All writes go through `ConfigurationServiceProvider.commitDefault`,
which stores secrets, updates `defaultsData`, writes the file and rolls everything back on failure. The config file
write is a plain `writeFile` (not temp + rename) so symlinked dotfiles keep working. Tests:
`tests/service/configuration/command/ConfigGetSetUnset.test.ts` and an end-to-end case in `tests/cli/BaseCLI.test.ts`.

Secret names (`DefaultSecretService`) are `<scope components>_Z<key components>`: each component is escaped
(alphanumerics kept, everything else incl. `_` becomes `_<HEX>_`) and joined with `_Z`, so distinct
(scope, key) pairs cannot collide and `ownsSecretName` is an exact scope-prefix match. The constructor takes
the scope as `string[]` (`["command", name]`, `["defaults"]`) and `setSecret`/`secretName` accept a key or key
components. Group member commands use the KV scope key `group:member` (same as their `defaults` key).
`resolveDefaultSecrets(value, commandKey)` only resolves sentinels naming a secret stored under `["defaults"]` with
`commandKey` as the first key component (`ownsSecretName(name, commandKey)`), so a command's defaults cannot pull another command's secrets.
