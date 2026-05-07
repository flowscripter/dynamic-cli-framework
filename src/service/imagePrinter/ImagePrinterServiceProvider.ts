import type {
  ServiceInfo,
  ServiceProvider,
} from "../../api/service/ServiceProvider.ts";
import DefaultImagePrinterService from "./DefaultImagePrinterService.ts";
import { IMAGE_PRINTER_SERVICE_ID } from "../../api/service/core/ImagePrinterService.ts";
import type Context from "../../api/Context.ts";
import type CLIConfig from "../../api/CLIConfig.ts";

export default class ImagePrinterServiceProvider implements ServiceProvider {
  readonly serviceId: string = IMAGE_PRINTER_SERVICE_ID;
  readonly #defaultImagePrinterService: DefaultImagePrinterService;

  public constructor(
    readonly servicePriority: number,
  ) {
    this.#defaultImagePrinterService = new DefaultImagePrinterService();
  }

  public provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#defaultImagePrinterService,
      commands: [],
    });
  }

  initService(_context: Context): Promise<void> {
    return Promise.resolve(undefined);
  }
}
