import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { ArgumentValues } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { Icon, PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { PLUGIN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { PluginService } from "@flowscripter/dynamic-cli-framework-api";
import { getPluginId } from "./getPluginId.ts";

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
