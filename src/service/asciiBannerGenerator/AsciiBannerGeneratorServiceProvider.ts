import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { AsciiBannerGeneratorService } from "@flowscripter/dynamic-cli-framework-api";
import { ASCII_BANNER_GENERATOR_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultAsciiBannerGeneratorService from "./DefaultAsciiBannerGeneratorService.ts";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Provides an {@link AsciiBannerGeneratorService}.
 */
export default class AsciiBannerGeneratorServiceProvider implements ServiceProvider {
  readonly serviceId: string = ASCII_BANNER_GENERATOR_SERVICE_ID;
  readonly servicePriority: number;
  readonly #asciiBannerGeneratorService: AsciiBannerGeneratorService;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   */
  public constructor(servicePriority: number) {
    this.servicePriority = servicePriority;
    this.#asciiBannerGeneratorService = new DefaultAsciiBannerGeneratorService();
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#asciiBannerGeneratorService,
      commands: [],
    });
  }

  initService(_context: Context): Promise<void> {
    return Promise.resolve(undefined);
  }
}
