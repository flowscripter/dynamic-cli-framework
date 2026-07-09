import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { ArgumentValues } from "@flowscripter/dynamic-cli-framework-api";
import { ArgumentValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
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
