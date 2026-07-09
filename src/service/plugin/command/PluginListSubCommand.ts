import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { ArgumentValues } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { PLUGIN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { PluginService } from "@flowscripter/dynamic-cli-framework-api";
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
