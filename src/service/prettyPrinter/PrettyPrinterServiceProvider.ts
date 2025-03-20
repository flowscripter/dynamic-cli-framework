import type {
  ServiceInfo,
  ServiceProvider,
} from "../../api/service/ServiceProvider.ts";
import DefaultPrettyPrinterService from "./DefaultPrettyPrinterService.ts";
import {
  PRETTY_PRINTER_SERVICE_ID,
} from "../../api/service/core/PrettyPrinterService.ts";
import type Context from "../../api/Context.ts";
import type CLIConfig from "../../api/CLIConfig.ts";

/**
 * Provides a {@link PrettyPrinterService}.
 */
export default class PrettyPrinterServiceProvider implements ServiceProvider {
  readonly serviceId: string = PRETTY_PRINTER_SERVICE_ID;
  readonly #defaultPrettyPrinterService: DefaultPrettyPrinterService;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   */
  public constructor(
    readonly servicePriority: number,
  ) {
    this.#defaultPrettyPrinterService = new DefaultPrettyPrinterService();
  }

  public provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#defaultPrettyPrinterService,
      commands: [],
    });
  }

  initService(_context: Context): Promise<void> {
    return Promise.resolve(undefined);
  }
}
