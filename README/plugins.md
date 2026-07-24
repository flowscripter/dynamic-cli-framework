# Plugins

Plugin support is provided via
[dynamic-plugin-framework](https://github.com/flowscripter/dynamic-plugin-framework).

## What is a CLI plugin?

A CLI plugin is a package that implements the `Plugin` interface from
`@flowscripter/dynamic-plugin-framework` and registers extensions against one
or both of the two CLI extension points:

| Extension point constant                                         | Extension type           | Effect                                           |
| ---------------------------------------------------------------- | ------------------------ | ------------------------------------------------ |
| `DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT`          | `CommandFactory`         | Provides one or more `Command` instances         |
| `DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT` | `ServiceProviderFactory` | Provides one or more `ServiceProvider` instances |

## Writing a plugin

Plugin authors should depend on
[`@flowscripter/dynamic-cli-framework-api`](https://github.com/flowscripter/dynamic-cli-framework-api)
rather than this package. It contains the same plugin-facing types,
interfaces and constants (previously available via the `./cli-plugin`
subpath of this package) but with near-zero runtime dependencies, so
installing a plugin doesn't also pull in this framework's concrete
service implementations and their dependencies (`figlet`, `emphasize`,
`highlight.js`, `prettier`, etc.). Declare it as a `peerDependency`:

```jsonc
{
  "peerDependencies": {
    "@flowscripter/dynamic-cli-framework-api": "*",
  },
}
```

```ts
import type {
  CommandFactory,
  ServiceProviderFactory,
  SubCommand,
  ServiceProvider,
} from "@flowscripter/dynamic-cli-framework-api";
import {
  DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT,
  DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT,
  ArgumentValueTypeName,
} from "@flowscripter/dynamic-cli-framework-api";
import type { Plugin, ExtensionDescriptor } from "@flowscripter/dynamic-plugin-framework";
```

Implement a `CommandFactory`:

```ts
class MyCommandFactory implements CommandFactory {
  getCommands() {
    return [mySubCommand];
  }
}
```

Implement a `ServiceProviderFactory`:

```ts
class MyServiceProviderFactory implements ServiceProviderFactory {
  getServiceProviders() {
    return [new MyServiceProvider()];
  }
}
```

Implement the plugin class and export it as the default export:

```ts
const myPlugin: Plugin = {
  extensionDescriptors: [
    {
      extensionPoint: DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT,
      factory: { create: async () => new MyCommandFactory() },
    },
    {
      extensionPoint: DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT,
      factory: { create: async () => new MyServiceProviderFactory() },
    },
  ],
};

export default myPlugin;
```

### Building a plugin for distribution

CLI plugins are installed and consumed via `node_modules` (see
`plugin:add`/`NpmPluginManager` below), so don't bundle them - transpile with
`tsc` instead, e.g.:

```json
{
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "rewriteRelativeImportExtensions": true
  },
  "include": ["index.ts", "src/**/*.ts"]
}
```

This mirrors your source tree into `dist/`, rewrites relative `.ts` imports
to `.js`, and leaves bare specifiers (e.g.
`@flowscripter/dynamic-cli-framework`, `@flowscripter/dynamic-plugin-framework`)
untouched so they resolve via `node_modules` at runtime instead of being
duplicated into your plugin's own build output. Declare
`@flowscripter/dynamic-cli-framework` as a `peerDependency` (and
`devDependency` for local type-checking) to signal that the host CLI
supplies it; regular `dependencies` your plugin actually ships with (e.g. a
helper library) resolve from `node_modules` the same way and don't need any
special handling.

## Enabling plugin support in a CLI

Enable `pluginServiceEnabled` (with `pluginServiceRemoteConfig` and `pluginServiceLocalConfig`)
on `launchMultiCommandCLI`, `launchSingleCommandCLI`, `BaseCLI`, or `DefaultRuntimeCLI`:

```ts
import { launchMultiCommandCLI } from "@flowscripter/dynamic-cli-framework";
import path from "node:path";
import os from "node:os";

const pluginsDir = path.join(os.homedir(), ".my-cli", "plugins", "node_modules");

await launchMultiCommandCLI(
  [myCommand],
  "My CLI description",
  "my-cli",
  packageJson.version,
  undefined,
  {
    pluginServiceEnabled: true,
    pluginServiceRemoteConfig: {
      name: "npmjs",
      registryUrl: "https://registry.npmjs.org",
      packageJsonNamespace: "mypluginframework",
    },
    pluginServiceLocalConfig: {
      nodeModulesPath: pluginsDir,
      packageJsonNamespace: "mypluginframework",
    },
  },
);
```

The `packageJsonNamespace` (`"mypluginframework"` above) is used to filter npm packages on the
registry and to identify installed plugin packages locally. Plugins should include this
namespace as a keyword in their `package.json` so they appear in search results.

### Overriding the default plugin repository configuration

An end user of the CLI can override the CLI author's default `pluginServiceRemoteConfig` and
`pluginServiceLocalConfig` via the CLI's JSON configuration file (see `ConfigurationServiceProvider`
for the full configuration file format), under the `key-values` property scoped to the
`PluginServiceProvider`'s service ID (`PLUGIN_SERVICE`):

```jsonc
{
  "key-values": {
    "services": {
      "PLUGIN_SERVICE": {
        "remotes-config": "[{\"name\":\"npmjs\",\"registryUrl\":\"https://registry.npmjs.org\",\"packageJsonNamespace\":\"mypluginframework\"}]",
        "local-config": "{\"nodeModulesPath\":\"/home/user/.my-cli/plugins/node_modules\",\"packageJsonNamespace\":\"mypluginframework\"}",
      },
    },
  },
}
```

`remotes-config` is a JSON-encoded array of `NpmjsPluginRepositoryConfig` (allowing more than one
remote repository to be configured) and `local-config` is a JSON-encoded `NpmPluginRepositoryConfig`.
Both values are read once, on startup, and replace the CLI author's defaults for that run.

## Plugin management commands

When plugin support is enabled, the `plugin` group command is automatically
available:

| Command                    | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| `plugin:list`              | List locally installed plugins                         |
| `plugin:search <query>`    | Search remote plugins                                  |
| `plugin:add <pluginId>`    | Install a plugin (e.g. `@scope/my-plugin`)             |
| `plugin:remove <pluginId>` | Remove an installed plugin                             |
| `plugin:upgrade`           | Upgrade all installed plugins to their latest versions |

After `plugin:add` or `plugin:upgrade`, the CLI must be restarted for the
new or updated plugin to be active.

## Example

See [example-cli-plugin](https://github.com/flowscripter/example-cli-plugin)
for a complete example plugin providing a demo command and service, and
[example-cli](https://github.com/flowscripter/example-cli) for a CLI that
supports installing it.
