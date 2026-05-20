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
- `deno fmt` - format (requires Deno)
- `deno lint index.ts src/ tests/` - lint (requires Deno)

## Directory Layout

```
index.ts          - Public entry point / all exports
src/
  api/            - Public interfaces only (no implementation)
    argument/     - Option, Positional, ComplexOption types
    command/      - Command, SubCommand, GlobalCommand, GroupCommand, GlobalModifierCommand
    service/      - ServiceProvider, core service interfaces (Printer, KeyValue, Shutdown, etc.)
  cli/            - BaseCLI, DefaultRuntimeCLI (Node/Bun runtime)
  command/        - Built-in commands: HelpCommand, VersionCommand, UsageCommand
  runtime/        - Execution engine
    registry/     - CommandRegistry, ServiceProviderRegistry
    parser.ts     - Argument parsing
    scanner.ts    - Command detection from argv
    runner.ts     - Main orchestrator (~707 lines, execution heart)
    values/       - Value population, merging, validation
  service/        - Built-in service implementations (printer, configuration, shutdown, banner, etc.)
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

1. For each ServiceProvider (by priority): scan/parse/execute its
   GlobalModifierCommands, then initialize the service
2. Execute any remaining GlobalModifierCommands
3. Scan/parse/execute one main command (or fallback to default command)
4. Return `RunResult` with `runState`, `command`, `invalidArguments`, or `error`

### Context

Holds `CLIConfig` and initialized service instances. Commands call
`context.getServiceById()` to access services.

### Configuration Injection

Commands with `enableConfiguration: true` receive defaults from env vars /
config files via `ConfigurationServiceProvider`.

## Key Interfaces (src/api/)

- `CLI` - `run(args, config): RunResult`
- `Command` / `SubCommand` / `GlobalCommand` / `GlobalModifierCommand` /
  `GroupCommand`
- `Argument` / `Option` / `Positional` / `ComplexOption`
- `ServiceProvider` / `Context`
- `RunResult` / `RunState` / `InvalidArgument` / `InvalidArgumentReason`

## Built-in Services

| Service                          | Priority | Purpose                                   |
| -------------------------------- | -------- | ----------------------------------------- |
| ShutdownServiceProvider          | 100      | Graceful shutdown hooks                   |
| ConfigurationServiceProvider     | 90       | Env var + config file defaults            |
| PrinterServiceProvider           | 80       | Colored stdout/stderr, spinners, progress |
| BannerServiceProvider            | -        | ASCII banner on startup                   |
| SyntaxHighlighterServiceProvider | -        | Code syntax highlighting                  |
| PrettyPrinterServiceProvider     | -        | JSON/object pretty printing               |

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
- `ts-log` - logging interface
- Peer: `typescript ^6.0.3`
