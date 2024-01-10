import Context from "../../api/Context.ts";
import LogLevelCommand from "./command/LogLevelCommand.ts";
import ServiceProvider, {
  ServiceInfo,
} from "../../api/service/ServiceProvider.ts";
import DefaultPrinterService from "./DefaultPrinterService.ts";
import { PRINTER_SERVICE_ID } from "../../api/service/core/PrinterService.ts";
import DarkModeCommand from "./command/DarkModeCommand.ts";
import NoColorCommand from "./command/NoColorCommand.ts";
import CLIConfig from "../../api/CLIConfig.ts";

/**
 * Provides a {@link PrinterService}.
 */
export default class PrinterServiceProvider implements ServiceProvider {
  readonly serviceId = PRINTER_SERVICE_ID;
  readonly servicePriority: number;
  readonly stdoutWriter: Deno.Writer;
  readonly stderrWriter: Deno.Writer;
  defaultPrinterService?: DefaultPrinterService;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   * @param stdoutWriter the Writer to use for stdout output.
   * @param stderrWriter the Writer to use for stderr output.
   */
  public constructor(
    servicePriority: number,
    stdoutWriter: Deno.Writer,
    stderrWriter: Deno.Writer,
  ) {
    this.servicePriority = servicePriority;
    this.stdoutWriter = stdoutWriter;
    this.stderrWriter = stderrWriter;
  }

  public provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    this.defaultPrinterService = new DefaultPrinterService(
      this.stdoutWriter,
      this.stderrWriter,
    );

    return Promise.resolve({
      service: this.defaultPrinterService,
      commands: [
        new DarkModeCommand(this, this.servicePriority + 2),
        new NoColorCommand(this, this.servicePriority + 1),
        new LogLevelCommand(this, this.servicePriority),
      ],
    });
  }

  initService(context: Context): Promise<void> {
    this.defaultPrinterService!.init(context);
    return Promise.resolve(undefined);
  }
}
