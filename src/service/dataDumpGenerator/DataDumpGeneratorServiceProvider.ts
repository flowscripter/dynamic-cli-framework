import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import DefaultDataDumpGeneratorService from "./DefaultDataDumpGeneratorService.ts";
import { DATA_DUMP_GENERATOR_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";

export default class DataDumpGeneratorServiceProvider implements ServiceProvider {
  readonly serviceId: string = DATA_DUMP_GENERATOR_SERVICE_ID;
  readonly #defaultService: DefaultDataDumpGeneratorService;

  public constructor(readonly servicePriority: number) {
    this.#defaultService = new DefaultDataDumpGeneratorService();
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#defaultService,
      commands: [],
    });
  }

  initService(context: Context): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;

    this.#defaultService.colorEnabled = printerService.colorEnabled;
    this.#defaultService.colorFunction = printerService.color.bind(printerService);

    return Promise.resolve(undefined);
  }
}
