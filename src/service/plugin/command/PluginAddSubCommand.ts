import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { ArgumentValues } from "@flowscripter/dynamic-cli-framework-api";
import { ArgumentValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { Icon, PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { PLUGIN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { PluginService } from "@flowscripter/dynamic-cli-framework-api";
import type { VersionedPluginDescriptor } from "@flowscripter/dynamic-plugin-framework";
import { getPluginId } from "./getPluginId.ts";

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
