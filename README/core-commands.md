# Core Commands

The core `Command` implementations provided with the framework are:

## `MultiCommandCliHelpGlobalCommand`

Implementation of multi-command CLI help. Some examples:

- `myCli --help`
- `myCli -h`
- `myCli --help <command>`
- `myCli -h <command>`

## `MultiCommandCliHelpSubCommand`

Implementation of multi-command CLI help. Some examples:

- `myCli help`
- `myCli help <command>`

## `SingleCommandCliHelpGlobalCommand`

Implementation of single (default) command CLI help. Some examples:

- `myCli --help`
- `myCli -h`

## `SingleCommandCliHelpSubCommand`

Implementation of single (default) command CLI help. An example:

- `myCli help`

## `UsageCommand`

Implementation which prints basic CLI usage instructions.

## `VersionCommand`

Implementation which prints the version of the CLI.
