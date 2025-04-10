import type Context from "../../api/Context.ts";
import type {
  ServiceInfo,
  ServiceProvider,
} from "../../api/service/ServiceProvider.ts";
import NoBannerCommand from "./command/NoBannerCommand.ts";
import type PrinterService from "../../api/service/core/PrinterService.ts";
import { PRINTER_SERVICE_ID } from "../../api/service/core/PrinterService.ts";
import type ConfigurationServiceProvider from "../configuration/ConfigurationServiceProvider.ts";
import type AsciiBannerGeneratorService from "../../api/service/core/AsciiBannerGeneratorService.ts";
import {
  ASCII_BANNER_GENERATOR_SERVICE_ID,
} from "../../api/service/core/AsciiBannerGeneratorService.ts";
import type CLIConfig from "../../api/CLIConfig.ts";
export const BANNER_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/banner-service";

/**
 * Provides ascii banner functionality.
 */
export default class BannerServiceProvider implements ServiceProvider {
  readonly serviceId: string = BANNER_SERVICE_ID;
  readonly servicePriority: number;
  readonly #configurationServiceProvider:
    | ConfigurationServiceProvider
    | undefined;

  /**
   * Whether or not to print the banner, defaults to true.
   */
  printBanner = true;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   * @param configurationServiceProvider an optional {@link ConfigurationServiceProvider} to make use of.
   * @param fontName an optional [FIGlet](http://www.figlet.org) font name to use for the banner, defaults to "standard".
   */
  public constructor(
    servicePriority: number,
    configurationServiceProvider?: ConfigurationServiceProvider,
    private readonly fontName: string = "standard",
  ) {
    this.servicePriority = servicePriority;
    this.#configurationServiceProvider = configurationServiceProvider;
  }

  public provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      commands: [
        new NoBannerCommand(this, this.servicePriority),
      ],
    });
  }

  async initService(context: Context): Promise<void> {
    if (this.printBanner === false) {
      return Promise.resolve();
    }

    const printerService = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as PrinterService;

    const asciiBannerGeneratorService = context.getServiceById(
      ASCII_BANNER_GENERATOR_SERVICE_ID,
    ) as AsciiBannerGeneratorService;

    const { cliConfig } = context;
    const bannerText = await asciiBannerGeneratorService.generate(
      cliConfig.name.toUpperCase(),
      this.fontName,
    );

    await printerService.info(printerService.blue(bannerText));
    if (cliConfig.description !== undefined) {
      await printerService.info(
        `  ${printerService.primary(cliConfig.description)}\n`,
      );
    }
    if (cliConfig.version.length > 0) {
      await printerService.info(
        `  ${printerService.secondary("version: " + cliConfig.version)}\n`,
      );
    }
    if (this.#configurationServiceProvider) {
      const configLocation = this.#configurationServiceProvider.configLocation;
      if (configLocation && configLocation.length > 0) {
        await printerService.info(
          `  ${
            printerService.secondary(
              "config: " + configLocation,
            )
          }\n`,
        );
      }
    }
    await printerService.info("\n");
  }
}
