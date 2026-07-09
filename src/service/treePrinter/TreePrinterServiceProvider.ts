import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import DefaultTreePrinterService from "./DefaultTreePrinterService.ts";
import { TREE_PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";

export default class TreePrinterServiceProvider implements ServiceProvider {
  readonly serviceId: string = TREE_PRINTER_SERVICE_ID;
  readonly #defaultTreePrinterService: DefaultTreePrinterService;

  public constructor(readonly servicePriority: number) {
    this.#defaultTreePrinterService = new DefaultTreePrinterService();
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#defaultTreePrinterService,
      commands: [],
    });
  }

  initService(context: Context): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;

    this.#defaultTreePrinterService.colorEnabled = printerService.colorEnabled;
    this.#defaultTreePrinterService.colorFunction = printerService.color.bind(printerService);

    return Promise.resolve(undefined);
  }
}
