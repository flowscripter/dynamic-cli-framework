import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { Values } from "@flowscripter/dynamic-cli-framework-api";
import { ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { Icon, PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { PLUGIN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { PluginService } from "@flowscripter/dynamic-cli-framework-api";

export class PluginRemoveSubCommand implements SubCommand {
  readonly name = "remove";
  readonly description = "Remove a locally installed plugin";
  readonly enableConfiguration = false;
  readonly options = [];
  readonly positionals = [
    {
      name: "pluginId",
      description: "Plugin ID to remove (e.g. @scope/name)",
      type: ValueTypeName.STRING,
    },
  ];

  async execute(context: Context, argumentValues: Values): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const pluginService = context.getServiceById(PLUGIN_SERVICE_ID) as PluginService;

    const pluginId = argumentValues["pluginId"] as string;

    let isInstalled = false;
    for await (const installed of pluginService.listInstalled()) {
      if (installed.pluginId === pluginId) {
        isInstalled = true;
        break;
      }
    }
    if (!isInstalled) {
      await printerService.print(`Plugin ${pluginId} is not installed.\n`, Icon.INFORMATION);
      return;
    }

    await printerService.showSpinner(`Removing plugin: ${pluginId}...`);
    try {
      await pluginService.uninstall(pluginId);
    } finally {
      await printerService.hideSpinner();
    }
    await printerService.print(`Plugin ${pluginId} removed.\n`, Icon.SUCCESS);
  }
}
