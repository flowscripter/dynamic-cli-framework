# Development

Install dependencies:

`bun install`

Build (produces `dist/` for Node.js and TypeScript consumers; Bun uses raw source directly):

`bun run build`

Test:

`bun test`

Format:

`bunx oxfmt`

Lint:

`bunx oxlint index.ts src/ tests/`

Generate HTML API Documentation:

`bunx typedoc index.ts`

### Debug Logging

Internal framework logging can be enabled by setting the
`DYNAMIC_CLI_FRAMEWORK_DEBUG` environment variable.

The logging implementation will look for an object conforming to the `Logger`
interface and use it if found. If not found, a simple logging implementation
using the `console` object will be used.

### Command and Service Validation

By default, commands and services that are built into the CLI or provided by
already installed plugins are not validated as they are loaded. The only
validation that takes place is for commands or services provided by plugins
BEFORE they are installed.

When using `launcher.ts` runtime validation of all commands can be
forced by defining the `DYNAMIC_CLI_FRAMEWORK_VALIDATE_ALL` environment
variable.

Command validation includes:

- ensuring multiple commands in the CLI do not have duplicate names or short
  aliases.
- command options for each command do not include duplicate names or short
  aliases.
- default values for options have the type specified by the option.
- default values for options match an allowable value if specified by the
  option.
- default array values for options are specified only for array options.
- command options for each command do not include duplicate names or short
  aliases.
- only the last positional for a command is defined as a vararg.
- default values for complex options match the nested property hierarchy.
- paths to nested properties of complex options are unique.
