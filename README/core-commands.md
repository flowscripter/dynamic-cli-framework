# Core Commands

The core `Command` implementations provided with the framework are:

## `PluginGroupCommand`

Implementation of plugin lifecycle management (`myCli plugin ...`), backed by
`PluginService`. Provided by `PluginServiceProvider` when plugin support
is enabled via `pluginServiceEnabled`. Has five sub-commands:

- `plugin list` lists plugins currently installed in the local plugin store.
- `plugin search <query>` searches the remote marketplace for plugins matching
  the given query.
- `plugin add <pluginId>` installs a plugin from the remote marketplace (e.g.
  `myCli plugin add @scope/my-plugin`).
- `plugin remove <pluginId>` removes a previously installed plugin.
- `plugin upgrade` checks all installed plugins for newer versions and
  installs any available updates.

NOTE: After `plugin add`, `plugin remove` or `plugin upgrade`, the CLI must be
restarted for new or updated plugin commands and service providers to become
active.

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
