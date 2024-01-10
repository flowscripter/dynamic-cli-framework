import ServiceProvider, {
  ServiceInfo,
} from "../../api/service/ServiceProvider.ts";
import DefaultSyntaxHighlighterService from "./DefaultSyntaxHighlighterService.ts";
import {
  HIGHLIGHTER_SERVICE_ID,
} from "../../api/service/core/SyntaxHighlighterService.ts";
import Context from "../../api/Context.ts";
import PrinterService, {
  PRINTER_SERVICE_ID,
} from "../../api/service/core/PrinterService.ts";
import CLIConfig from "../../api/CLIConfig.ts";

/**
 * Provides a {@link SyntaxHighlighterService}.
 */
export default class SyntaxHighlighterServiceProvider
  implements ServiceProvider {
  readonly serviceId = HIGHLIGHTER_SERVICE_ID;
  readonly servicePriority: number;
  readonly defaultSyntaxHighlighterService: DefaultSyntaxHighlighterService;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   */
  public constructor(
    servicePriority: number,
  ) {
    this.servicePriority = servicePriority;
    this.defaultSyntaxHighlighterService =
      new DefaultSyntaxHighlighterService();
  }

  public provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.defaultSyntaxHighlighterService,
      commands: [],
    });
  }

  initService(context: Context): Promise<void> {
    const printerService = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as PrinterService;

    this.defaultSyntaxHighlighterService.colorEnabled =
      printerService.colorEnabled;

    return Promise.resolve(undefined);
  }
}
