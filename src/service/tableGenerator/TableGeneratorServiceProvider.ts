import type {
  ServiceInfo,
  ServiceProvider,
} from "../../api/service/ServiceProvider.ts";
import DefaultTableGeneratorService from "./DefaultTableGeneratorService.ts";
import { TABLE_GENERATOR_SERVICE_ID } from "../../api/service/core/TableGeneratorService.ts";
import type Context from "../../api/Context.ts";
import type PrinterService from "../../api/service/core/PrinterService.ts";
import { PRINTER_SERVICE_ID } from "../../api/service/core/PrinterService.ts";
import type CLIConfig from "../../api/CLIConfig.ts";

export default class TableGeneratorServiceProvider implements ServiceProvider {
  readonly serviceId: string = TABLE_GENERATOR_SERVICE_ID;
  readonly #defaultTableGeneratorService: DefaultTableGeneratorService;

  public constructor(
    readonly servicePriority: number,
  ) {
    this.#defaultTableGeneratorService = new DefaultTableGeneratorService();
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#defaultTableGeneratorService,
      commands: [],
    });
  }

  initService(context: Context): Promise<void> {
    const printerService = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as PrinterService;

    this.#defaultTableGeneratorService.colorEnabled =
      printerService.colorEnabled;
    this.#defaultTableGeneratorService.colorFunction = printerService.color
      .bind(printerService);
    this.#defaultTableGeneratorService.backgroundColorFunction = printerService
      .backgroundColor.bind(printerService);

    return Promise.resolve(undefined);
  }
}
