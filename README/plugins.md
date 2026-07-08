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

Import the plugin author API from the dedicated entry point:

```ts
import type {
  CommandFactory,
  ServiceProviderFactory,
  SubCommand,
  ServiceProvider,
} from "@flowscripter/dynamic-cli-framework/cli-plugin";
import {
  DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT,
  DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT,
  ArgumentValueTypeName,
} from "@flowscripter/dynamic-cli-framework/cli-plugin";
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

## Enabling plugin support in a CLI

Use `DynamicPluginRuntimeCLI` or the `launchDynamicPluginMultiCommandCLI` convenience
function instead of their non-plugin counterparts:

```ts
import { launchDynamicPluginMultiCommandCLI } from "@flowscripter/dynamic-cli-framework";
import {
  NpmPluginManager,
  NpmPluginRepository,
  NpmjsPluginRepository,
} from "@flowscripter/dynamic-plugin-framework";
import path from "node:path";
import os from "node:os";

const pluginsDir = path.join(os.homedir(), ".my-cli", "plugins", "node_modules");
const pluginManager = new NpmPluginManager(
  [new NpmjsPluginRepository("mypluginframework")],
  new NpmPluginRepository(pluginsDir, "mypluginframework"),
);

await launchDynamicPluginMultiCommandCLI(
  pluginManager,
  [myCommand],
  "My CLI description",
  "my-cli",
  packageJson.version,
);
```

The `NpmjsPluginRepository` keyword (`"mypluginframework"` above) is used to
filter npm packages on the registry. Plugins should include this keyword in
their `package.json` so they appear in search results.

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
