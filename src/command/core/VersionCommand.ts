import { ArgumentValues } from "../../api/argument/ArgumentValueTypes.ts";
import Context from "../../api/runtime/Context.ts";
import GlobalCommand from "../../api/command/GlobalCommand.ts";
import Printer, { PRINTER_SERVICE_ID } from "../../api/service/core/Printer.ts";

/**
 * Implementation of a {@link GlobalCommand} which outputs the version of the CLI.
 */
export default class VersionCommand implements GlobalCommand {
  readonly name = "version";
  readonly description = "Show version information";
  readonly shortAlias = "v";

  public async execute(
    _argumentValues: ArgumentValues,
    context: Context,
  ): Promise<void> {
    const printer = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as Printer;
    await printer.print(`${context.cliConfig.version}\n`);
  }
}
