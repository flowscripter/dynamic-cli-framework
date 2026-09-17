# Startup Tasks

A `StartupTask` is priority-ordered work registered to run once during CLI
startup - via `BaseCLI.addStartupTask`, or the `startupTasks` array parameter
of `launchSingleCommandCLI`/`launchMultiCommandCLI`. Every registered
`ServiceProvider`'s `initService()` call is itself wrapped as a `StartupTask`
and merged, in priority order, with any directly-registered `StartupTask`s
into a single sequence. See [Implementation Details](./implementation-details.md)
for the full runner sequence and diagram.

Each task's `mode` (defaulting to `"blocking"`, which is how every
`ServiceProvider`'s `initService()` behaves) determines whether the `runner`
awaits it before moving to the next lower-priority task, or fires it without
awaiting (`"background"`, with errors logged rather than propagated).

## Banner startup task

ASCII banner output is not a `ServiceProvider` - it is a `StartupTask` built by
`createBannerStartupTask(priority, fontName?)`. A consumer opts in by passing
the result of this function in the `startupTasks` array parameter of
`launchSingleCommandCLI`/`launchMultiCommandCLI` (or via `BaseCLI.addStartupTask`)
- there is no default/automatic banner registration.

On running, it uses the `PrinterService` to output the CLI name in ASCII
banner text together with the CLI description, version, optional sub-message
(from `CLIConfig.subMessage`) and, if a `ConfigurationService` is registered
and a config file location is set, the config location. If a `KeyValueService`
is registered and holds a cached upgrade-check result showing a newer version
available, an additional
`(<latest version> available, run '<cli name> upgrade')` line is shown below
the version - the banner task only ever reads this cached result, it never
triggers a live upgrade check itself.

Provides (as `modifierCommands`):

- `NoBannerCommand` allowing banner printing to be disabled via the argument
  `--no-banner` or the env var `NO_BANNER`.
