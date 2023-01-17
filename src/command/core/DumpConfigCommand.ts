import ConfigurationService from "../../service/core/ConfigurationService.ts";
import Context from "../../api/Context.ts";
import GlobalCommand from "../../api/command/GlobalCommand.ts";
import { ArgumentValues } from "../../api/argument/ArgumentValueTypes.ts";
import Printer, { PRINTER_SERVICE_ID } from "../../api/service/core/Printer.ts";

/**
 * Command which dumps the configuration loaded by the {@link ConfigurationService}.
 */
export default class DumpConfigCommand implements GlobalCommand {
  readonly name = "dump-config";
  readonly description = "Dump configuration values";

  private readonly configurationService: ConfigurationService;

  public constructor(
    configurationService: ConfigurationService,
  ) {
    this.configurationService = configurationService;
  }

  public async execute(
    _argumentValues: ArgumentValues,
    context: Context,
  ): Promise<void> {
    const printer = context.getServiceById(PRINTER_SERVICE_ID) as Printer;

    await printer.print(
      `${
        JSON.stringify(
          // TODO: access via CONFIGURATION_SERVICE_ID, for every command and service (or specified command or service), get config and output
          this.configurationService.configuredArgumentValuesByCommandName,
          null,
          // TODO: print secret value type as XXX
          2,
        )
      }\n`,
    );
  }
}
