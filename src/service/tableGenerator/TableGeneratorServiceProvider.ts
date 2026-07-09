import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import DefaultTableGeneratorService from "./DefaultTableGeneratorService.ts";
import { TABLE_GENERATOR_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";

export default class TableGeneratorServiceProvider implements ServiceProvider {
  readonly serviceId: string = TABLE_GENERATOR_SERVICE_ID;
  readonly #defaultTableGeneratorService: DefaultTableGeneratorService;

  public constructor(readonly servicePriority: number) {
    this.#defaultTableGeneratorService = new DefaultTableGeneratorService();
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#defaultTableGeneratorService,
      commands: [],
    });
  }

  initService(context: Context): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;

    this.#defaultTableGeneratorService.colorEnabled = printerService.colorEnabled;
    this.#defaultTableGeneratorService.colorFunction = printerService.color.bind(printerService);
    this.#defaultTableGeneratorService.backgroundColorFunction =
      printerService.backgroundColor.bind(printerService);

    return Promise.resolve(undefined);
  }
}
