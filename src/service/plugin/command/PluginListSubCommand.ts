import type SubCommand from "../../../api/command/SubCommand.ts";
import type Context from "../../../api/Context.ts";
import type { ArgumentValues } from "../../../api/argument/ArgumentValueTypes.ts";
import type PrinterService from "../../../api/service/core/PrinterService.ts";
import { PRINTER_SERVICE_ID } from "../../../api/service/core/PrinterService.ts";
import { PLUGIN_SERVICE_ID } from "../../../api/service/core/PluginService.ts";
import type PluginService from "../../../api/service/core/PluginService.ts";
import { getPluginId } from "./getPluginId.ts";

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
