import type SubCommand from "../../../api/command/SubCommand.ts";
import type Context from "../../../api/Context.ts";
import type { ArgumentValues } from "../../../api/argument/ArgumentValueTypes.ts";
import type PrinterService from "../../../api/service/core/PrinterService.ts";
import { Icon, PRINTER_SERVICE_ID } from "../../../api/service/core/PrinterService.ts";
import { PLUGIN_SERVICE_ID } from "../../../api/service/core/PluginService.ts";
import type PluginService from "../../../api/service/core/PluginService.ts";
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
