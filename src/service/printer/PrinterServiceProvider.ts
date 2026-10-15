import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import LogLevelCommand from "./command/LogLevelCommand.ts";
import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import ThemeCommand from "./command/ThemeCommand.ts";
import NoColorCommand from "./command/NoColorCommand.ts";
import NoHyperlinksCommand from "./command/NoHyperlinksCommand.ts";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import type { ShutdownService } from "@flowscripter/dynamic-cli-framework-api";
import { SHUTDOWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { CLEANUP_SHUTDOWN_TASK_PRIORITY } from "../../runtime/lifecycle/priorities.ts";

/**
 * Provides a {@link PrinterService}.
 */
export default class PrinterServiceProvider implements ServiceProvider {
  readonly serviceId: string = PRINTER_SERVICE_ID;
  readonly servicePriority: number;
  readonly printerService: PrinterService;
  readonly detectDarkBackground: (() => Promise<boolean | undefined>) | undefined;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   * @param printerService the PrinterService implementation to use.
   * @param detectDarkBackground optional function detecting whether the terminal background is dark.
   */
  public constructor(
    servicePriority: number,
    printerService: PrinterService,
    detectDarkBackground?: () => Promise<boolean | undefined>,
  ) {
    this.servicePriority = servicePriority;
    this.printerService = printerService;
    this.detectDarkBackground = detectDarkBackground;
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.printerService,
      commands: [
        new NoHyperlinksCommand(this.servicePriority + 3),
        new ThemeCommand(this.servicePriority + 1, this.detectDarkBackground),
        new NoColorCommand(this.servicePriority + 2),
        new LogLevelCommand(this.servicePriority),
      ],
    });
  }

  initService(context: Context): Promise<void> {
    const shutdownService = context.getServiceById(SHUTDOWN_SERVICE_ID) as ShutdownService;
    shutdownService.registerTask({
      id: PRINTER_SERVICE_ID,
      priority: CLEANUP_SHUTDOWN_TASK_PRIORITY,
      run: async () => {
        await this.printerService.hideSpinner();
        await this.printerService.hideAllProgressBars();
      },
    });

    return Promise.resolve();
  }
}
