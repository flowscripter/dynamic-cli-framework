import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import DefaultPrettyPrinterService from "./DefaultPrettyPrinterService.ts";
import { PRETTY_PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";

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
  public constructor(readonly servicePriority: number) {
    this.#defaultPrettyPrinterService = new DefaultPrettyPrinterService();
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#defaultPrettyPrinterService,
      commands: [],
    });
  }

  initService(_context: Context): Promise<void> {
    return Promise.resolve(undefined);
  }
}
