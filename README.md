# dynamic-cli-framework

[![version](https://img.shields.io/github/v/release/flowscripter/dynamic-cli-framework?sort=semver)](https://github.com/flowscripter/dynamic-cli-framework/releases)
[![build](https://img.shields.io/github/actions/workflow/status/flowscripter/dynamic-cli-framework/release-bun-library.yml)](https://github.com/flowscripter/dynamic-cli-framework/actions/workflows/release-bun-library.yml)
[![coverage](https://codecov.io/gh/flowscripter/dynamic-cli-framework/branch/main/graph/badge.svg?token=EMFT2938ZF)](https://codecov.io/gh/flowscripter/dynamic-cli-framework)
[![docs](https://img.shields.io/badge/docs-API-blue)](https://flowscripter.github.io/dynamic-cli-framework/index.html)
[![license: MIT](https://img.shields.io/github/license/flowscripter/dynamic-cli-framework)](https://github.com/flowscripter/dynamic-cli-framework/blob/main/LICENSE)

> A framework for developing CLI applications which supports dynamic discovery
> and installation of new commands

[//]: # (TODO: Remove this when plugin support.)

NOTE: The dynamic aspect is still in development as it relies upon:

- some outstanding work on the
  [dynamic-plugin-framework](https://github.com/flowscripter/dynamic-plugin-framework)
  dependency.

So it isn't really dynamic at the moment! 😜

## Key Features

- Flexible CLI definitions:
  - a single default global command with global arguments e.g.
    `executable [global_arguments]`
  - multiple sub-commands with sub-command based arguments e.g.
    `executable <sub_command> [sub_command_arguments]`
  - multiple grouped member sub-commands with member sub-command based arguments
    e.g.
    `executable <group_command> <member_sub_command> [member_sub_command_arguments]`
  - A mix of the above!
- Support for both named option and position based arguments e.g.
  `executable --<option_name>=<option_value> <positional_value>`
- Support for specifying multiple values for:
  - named options arguments via either:
    - implicitly indexed repeated arguments e.g.
      `executable --<option_name>=<option_value_1> --<option_name>=<option_value_2>`
    - or explicitly indexed arguments e.g.
      `executable --<option_name>[0]=<option_value_1> --<option_name>[1]=<option_value_2>`
  - position based arguments ("varargs") e.g.
    `executable <positional_1_value_1> <positional_1_value_2>`
- Support for complex nested options e.g.
  `executable --<option_name>.<property_1_name>=<property_1_value> --<option_name>.<property_1>.<property_1_a>=<property_1_a_value>`
- Support (optional) for persisted configuration and environment variables to
  specify command argument defaults.
- Core (but optional) commands for help, logging level and version management.
- Core (but optional) services for color output (foreground and background),
  syntax highlighting, pretty printing, table and tree structure rendering,
  configuration management, and user input prompting.
- Graceful signal handling (SIGINT/SIGTERM) with shutdown hooks, cooperative
  cancellation for long-running commands, and triple-interrupt force exit.
- Core (but optional) support for dynamic discovery and installation of commands
  and services using
  [dynamic-plugin-framework](https://github.com/flowscripter/dynamic-plugin-framework)
- Minimal dependencies.
- Bun based.
- Based on native JavaScript modules.
- Written in Typescript.
- Compiled to a binary executable using a Bun runtime.

## Usage Examples

The following example projects are available:

- [example-cli](https://github.com/flowscripter/example-cli) is an example CLI
  application based on this framework.
- [mpeg-sdl-tool](https://github.com/flowscripter/mpeg-sdl-tool) is a real world
  use case CLI application based on this framework.

[//]: # (TODO: Add this when implemented.)
[//]: # (- [example-cli-plugin]&#40;https://github.com/flowscripter/example-cli-plugin&#41; is an)
[//]: # (  example command and service plugin based on this framework.)

## Further Details

- [Key Concepts](./README/key-concepts.md)
- [Implementation Details](./README/implementation-details.md)
- [Core Service Providers](./README/core-service-providers.md)
- [Core Commands](./README/core-commands.md)
- [Development](./README/development.md)
- [API Documentation](https://flowscripter.github.io/dynamic-cli-framework/index.html)

## License

MIT © Flowscripter
