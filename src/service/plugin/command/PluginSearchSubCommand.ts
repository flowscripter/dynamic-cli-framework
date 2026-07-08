import type SubCommand from "../../../api/command/SubCommand.ts";
import type Context from "../../../api/Context.ts";
import type { ArgumentValues } from "../../../api/argument/ArgumentValueTypes.ts";
import { ArgumentValueTypeName } from "../../../api/argument/ArgumentValueTypes.ts";
import type PrinterService from "../../../api/service/core/PrinterService.ts";
import { PRINTER_SERVICE_ID } from "../../../api/service/core/PrinterService.ts";
import { PLUGIN_SERVICE_ID } from "../../../api/service/core/PluginService.ts";
import type PluginService from "../../../api/service/core/PluginService.ts";
import { getPluginId } from "./getPluginId.ts";

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
