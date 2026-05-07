import type {
  ServiceInfo,
  ServiceProvider,
} from "../../api/service/ServiceProvider.ts";
import DefaultTreePrinterService from "./DefaultTreePrinterService.ts";
import { TREE_PRINTER_SERVICE_ID } from "../../api/service/core/TreePrinterService.ts";
import type Context from "../../api/Context.ts";
import type PrinterService from "../../api/service/core/PrinterService.ts";
import { PRINTER_SERVICE_ID } from "../../api/service/core/PrinterService.ts";
import type CLIConfig from "../../api/CLIConfig.ts";

export default class TreePrinterServiceProvider implements ServiceProvider {
  readonly serviceId: string = TREE_PRINTER_SERVICE_ID;
  readonly #defaultTreePrinterService: DefaultTreePrinterService;

  public constructor(
    readonly servicePriority: number,
  ) {
    this.#defaultTreePrinterService = new DefaultTreePrinterService();
  }

  public provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#defaultTreePrinterService,
      commands: [],
    });
  }

  initService(context: Context): Promise<void> {
    const printerService = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as PrinterService;

    this.#defaultTreePrinterService.colorEnabled = printerService.colorEnabled;
    this.#defaultTreePrinterService.colorFunction = printerService.color
      .bind(printerService);

    return Promise.resolve(undefined);
  }
}
