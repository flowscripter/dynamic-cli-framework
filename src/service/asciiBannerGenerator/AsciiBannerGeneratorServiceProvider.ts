import type {
  ServiceInfo,
  ServiceProvider,
} from "../../api/service/ServiceProvider.ts";
import type Context from "../../api/Context.ts";
import type AsciiBannerGeneratorService from "../../api/service/core/AsciiBannerGeneratorService.ts";
import {
  ASCII_BANNER_GENERATOR_SERVICE_ID,
} from "../../api/service/core/AsciiBannerGeneratorService.ts";
import DefaultAsciiBannerGeneratorService from "./DefaultAsciiBannerGeneratorService.ts";
import type CLIConfig from "../../api/CLIConfig.ts";

/**
 * Provides an {@link AsciiBannerGeneratorService}.
 */
export default class AsciiBannerGeneratorServiceProvider
  implements ServiceProvider {
  readonly serviceId: string = ASCII_BANNER_GENERATOR_SERVICE_ID;
  readonly servicePriority: number;
  readonly #asciiBannerGeneratorService: AsciiBannerGeneratorService;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   */
  public constructor(
    servicePriority: number,
  ) {
    this.servicePriority = servicePriority;
    this.#asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();
  }

  public provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#asciiBannerGeneratorService,
      commands: [],
    });
  }

  initService(_context: Context): Promise<void> {
    return Promise.resolve(undefined);
  }
}
