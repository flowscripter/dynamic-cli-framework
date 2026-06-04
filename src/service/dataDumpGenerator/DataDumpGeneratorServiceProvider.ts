import type {
  ServiceInfo,
  ServiceProvider,
} from "../../api/service/ServiceProvider.ts";
import DefaultDataDumpGeneratorService from "./DefaultDataDumpGeneratorService.ts";
import { DATA_DUMP_GENERATOR_SERVICE_ID } from "../../api/service/core/DataDumpGeneratorService.ts";
import type Context from "../../api/Context.ts";
import type PrinterService from "../../api/service/core/PrinterService.ts";
import { PRINTER_SERVICE_ID } from "../../api/service/core/PrinterService.ts";
import type CLIConfig from "../../api/CLIConfig.ts";

export default class DataDumpGeneratorServiceProvider
  implements ServiceProvider {
  readonly serviceId: string = DATA_DUMP_GENERATOR_SERVICE_ID;
  readonly #defaultService: DefaultDataDumpGeneratorService;

  public constructor(
    readonly servicePriority: number,
  ) {
    this.#defaultService = new DefaultDataDumpGeneratorService();
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#defaultService,
      commands: [],
    });
  }

  initService(context: Context): Promise<void> {
    const printerService = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as PrinterService;

    this.#defaultService.colorEnabled = printerService.colorEnabled;
    this.#defaultService.colorFunction = printerService.color
      .bind(printerService);

    return Promise.resolve(undefined);
  }
}
