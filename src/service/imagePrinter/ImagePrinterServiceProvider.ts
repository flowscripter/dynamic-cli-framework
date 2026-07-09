import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import DefaultImagePrinterService from "./DefaultImagePrinterService.ts";
import { IMAGE_PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import type Terminal from "../../terminal/Terminal.ts";

export default class ImagePrinterServiceProvider implements ServiceProvider {
  readonly serviceId: string = IMAGE_PRINTER_SERVICE_ID;
  readonly #defaultImagePrinterService: DefaultImagePrinterService;

  public constructor(
    readonly servicePriority: number,
    terminal: Terminal,
  ) {
    this.#defaultImagePrinterService = new DefaultImagePrinterService(terminal);
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#defaultImagePrinterService,
      commands: [],
    });
  }

  initService(_context: Context): Promise<void> {
    return Promise.resolve(undefined);
  }
}
