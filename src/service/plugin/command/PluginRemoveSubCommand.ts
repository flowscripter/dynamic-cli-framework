import type SubCommand from "../../../api/command/SubCommand.ts";
import type Context from "../../../api/Context.ts";
import type { ArgumentValues } from "../../../api/argument/ArgumentValueTypes.ts";
import { ArgumentValueTypeName } from "../../../api/argument/ArgumentValueTypes.ts";
import type PrinterService from "../../../api/service/core/PrinterService.ts";
import { Icon, PRINTER_SERVICE_ID } from "../../../api/service/core/PrinterService.ts";
import { PLUGIN_SERVICE_ID } from "../../../api/service/core/PluginService.ts";
import type PluginService from "../../../api/service/core/PluginService.ts";

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
