import type Context from "../../api/Context.ts";
import LogLevelCommand from "./command/LogLevelCommand.ts";
import type {
  ServiceInfo,
  ServiceProvider,
} from "../../api/service/ServiceProvider.ts";
import DefaultPrinterService from "./DefaultPrinterService.ts";
import { PRINTER_SERVICE_ID } from "../../api/service/core/PrinterService.ts";
import DarkModeCommand from "./command/DarkModeCommand.ts";
import NoColorCommand from "./command/NoColorCommand.ts";
import type CLIConfig from "../../api/CLIConfig.ts";

/**
 * Provides a {@link PrinterService}.
 */
export default class PrinterServiceProvider implements ServiceProvider {
  readonly serviceId: string = PRINTER_SERVICE_ID;
  readonly servicePriority: number;
  readonly stdoutWritable: WritableStream;
  readonly stderrWritable: WritableStream;
  printerService?: DefaultPrinterService;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   * @param stdoutWritableStream the WritableStream to use for stdout output.
   * @param stderrWritableStream the WritableStream to use for stderr output.
   */
  public constructor(
    servicePriority: number,
    stdoutWritableStream: WritableStream,
    stderrWritableStream: WritableStream,
  ) {
    this.servicePriority = servicePriority;
    this.stdoutWritable = stdoutWritableStream;
    this.stderrWritable = stderrWritableStream;
  }

  public provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    this.printerService = new DefaultPrinterService(
      this.stdoutWritable,
      this.stderrWritable,
    );

    return Promise.resolve({
      service: this.printerService,
      commands: [
        new DarkModeCommand(this, this.servicePriority + 2),
        new NoColorCommand(this, this.servicePriority + 1),
        new LogLevelCommand(this, this.servicePriority),
      ],
    });
  }

  initService(context: Context): Promise<void> {
    this.printerService!.init(context);
    return Promise.resolve(undefined);
  }
}
