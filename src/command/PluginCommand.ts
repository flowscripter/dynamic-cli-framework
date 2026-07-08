import type GroupCommand from "../api/command/GroupCommand.ts";
import type SubCommand from "../api/command/SubCommand.ts";
import type Context from "../api/Context.ts";
import type { ArgumentValues } from "../api/argument/ArgumentValueTypes.ts";
import { ArgumentValueTypeName } from "../api/argument/ArgumentValueTypes.ts";
import type PrinterService from "../api/service/core/PrinterService.ts";
import { Icon, PRINTER_SERVICE_ID } from "../api/service/core/PrinterService.ts";
import { PLUGIN_SERVICE_ID } from "../api/service/core/PluginService.ts";
import type PluginService from "../api/service/core/PluginService.ts";
import type { VersionedPluginDescriptor } from "@flowscripter/dynamic-plugin-framework";

function getPluginId(descriptor: VersionedPluginDescriptor): string {
  return descriptor.scope ? `@${descriptor.scope}/${descriptor.name}` : descriptor.name;
}

export class PluginListSubCommand implements SubCommand {
  readonly name = "list";
  readonly description = "List locally installed plugins";
  readonly enableConfiguration = false;
  readonly options = [];
  readonly positionals = [];

  async execute(context: Context, _argumentValues: ArgumentValues): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const pluginService = context.getServiceById(PLUGIN_SERVICE_ID) as PluginService;

    let found = false;
    for await (const descriptor of pluginService.listInstalled()) {
      if (!found) {
        found = true;
        await printerService.print("Installed plugins:\n");
      }
      await printerService.print(`  ${getPluginId(descriptor)}  ${descriptor.version}\n`);
    }
    if (!found) {
      await printerService.print("No plugins installed.\n");
    }
  }
}

export class PluginSearchSubCommand implements SubCommand {
  readonly name = "search";
  readonly description = "Search remote plugins";
  readonly enableConfiguration = false;
  readonly options = [];
  readonly positionals = [
    {
      name: "query",
      description: "Search query",
      type: ArgumentValueTypeName.STRING,
      isVarargOptional: true,
    },
  ];

  async execute(context: Context, argumentValues: ArgumentValues): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const pluginService = context.getServiceById(PLUGIN_SERVICE_ID) as PluginService;

    const query = (argumentValues["query"] as string | undefined) ?? "";
    let found = false;
    for await (const descriptor of pluginService.search({ text: query })) {
      if (!found) {
        found = true;
        await printerService.print("Available plugins:\n");
      }
      await printerService.print(`  ${getPluginId(descriptor)}  ${descriptor.version}\n`);
    }
    if (!found) {
      await printerService.print("No plugins found.\n");
    }
  }
}

export class PluginAddSubCommand implements SubCommand {
  readonly name = "add";
  readonly description = "Install a remote plugin";
  readonly enableConfiguration = false;
  readonly options = [];
  readonly positionals = [
    {
      name: "pluginId",
      description: "Plugin ID to install (e.g. @scope/name)",
      type: ArgumentValueTypeName.STRING,
    },
  ];

  async execute(context: Context, argumentValues: ArgumentValues): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const pluginService = context.getServiceById(PLUGIN_SERVICE_ID) as PluginService;

    const pluginId = argumentValues["pluginId"] as string;
    await printerService.info(`Searching for plugin: ${pluginId}\n`, Icon.INFORMATION);

    let descriptor: VersionedPluginDescriptor | undefined;
    for await (const d of pluginService.search({ text: pluginId })) {
      if (getPluginId(d) === pluginId || d.pluginId === pluginId) {
        descriptor = d;
        break;
      }
    }

    if (!descriptor) {
      // Search did not find an exact match - attempt direct install by plugin ID.
      // This handles cases where the package exists on the registry but is not
      // returned by search (e.g. recently published or low search ranking).
      await printerService.info(
        `Plugin not found via search, attempting direct install of ${pluginId}...\n`,
        Icon.INFORMATION,
      );
      const parts = pluginId.startsWith("@") ? pluginId.slice(1).split("/") : [undefined, pluginId];
      const scope = pluginId.startsWith("@") ? `@${parts[0]}` : undefined;
      const name = pluginId.startsWith("@") ? parts[1]! : pluginId;
      descriptor = {
        pluginId,
        scope,
        name,
        version: "latest",
        extensionPoints: [],
      };
    }

    await printerService.info(`Installing ${descriptor.pluginId}...\n`, Icon.INFORMATION);
    await pluginService.install(descriptor);
    await printerService.print(`Plugin ${descriptor.pluginId} installed.\n`, Icon.SUCCESS);
  }
}

export class PluginRemoveSubCommand implements SubCommand {
  readonly name = "remove";
  readonly description = "Remove a locally installed plugin";
  readonly enableConfiguration = false;
  readonly options = [];
  readonly positionals = [
    {
      name: "pluginId",
      description: "Plugin ID to remove (e.g. @scope/name)",
      type: ArgumentValueTypeName.STRING,
    },
  ];

  async execute(context: Context, argumentValues: ArgumentValues): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const pluginService = context.getServiceById(PLUGIN_SERVICE_ID) as PluginService;

    const pluginId = argumentValues["pluginId"] as string;
    await printerService.info(`Removing plugin: ${pluginId}...\n`, Icon.INFORMATION);
    await pluginService.uninstall(pluginId);
    await printerService.print(`Plugin ${pluginId} removed.\n`, Icon.SUCCESS);
  }
}

export class PluginUpgradeSubCommand implements SubCommand {
  readonly name = "upgrade";
  readonly description = "Upgrade locally installed plugins";
  readonly enableConfiguration = false;
  readonly options = [];
  readonly positionals = [];

  async execute(context: Context, _argumentValues: ArgumentValues): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const pluginService = context.getServiceById(PLUGIN_SERVICE_ID) as PluginService;

    let upgraded = 0;
    for await (const update of pluginService.checkForUpdates()) {
      const id = getPluginId(update.descriptor);
      await printerService.info(
        `Upgrading ${id} to ${update.availableVersion}...\n`,
        Icon.INFORMATION,
      );
      await pluginService.install(update.descriptor);
      await printerService.print(`Upgraded ${id} to ${update.availableVersion}.\n`, Icon.SUCCESS);
      upgraded++;
    }
    if (upgraded === 0) {
      await printerService.print("All plugins are up to date.\n");
    }
  }
}

export class PluginGroupCommand implements GroupCommand {
  readonly name = "plugin";
  readonly description = "Manage CLI plugins";
  readonly enableConfiguration = false;
  readonly memberSubCommands: ReadonlyArray<SubCommand>;

  constructor() {
    this.memberSubCommands = [
      new PluginListSubCommand(),
      new PluginSearchSubCommand(),
      new PluginAddSubCommand(),
      new PluginRemoveSubCommand(),
      new PluginUpgradeSubCommand(),
    ];
  }

  async execute(_context: Context): Promise<void> {}
}
