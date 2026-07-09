import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import LogLevelCommand from "./command/LogLevelCommand.ts";
import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DarkModeCommand from "./command/DarkModeCommand.ts";
import NoColorCommand from "./command/NoColorCommand.ts";
import NoHyperlinksCommand from "./command/NoHyperlinksCommand.ts";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import type { ShutdownService } from "@flowscripter/dynamic-cli-framework-api";
import { SHUTDOWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Provides a {@link PrinterService}.
 */
export default class PrinterServiceProvider implements ServiceProvider {
  readonly serviceId: string = PRINTER_SERVICE_ID;
  readonly servicePriority: number;
  readonly printerService: PrinterService;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   * @param printerService the PrinterService implementation to use.
   */
  public constructor(servicePriority: number, printerService: PrinterService) {
    this.servicePriority = servicePriority;
    this.printerService = printerService;
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.printerService,
      commands: [
        new NoHyperlinksCommand(this, this.servicePriority + 3),
        new DarkModeCommand(this, this.servicePriority + 2),
        new NoColorCommand(this, this.servicePriority + 1),
        new LogLevelCommand(this, this.servicePriority),
      ],
    });
  }

  initService(context: Context): Promise<void> {
    const shutdownService = context.getServiceById(SHUTDOWN_SERVICE_ID) as ShutdownService;
    shutdownService.addShutdownListener(async () => {
      await this.printerService.hideSpinner();
      await this.printerService.hideAllProgressBars();
    });

    return Promise.resolve();
  }
}
