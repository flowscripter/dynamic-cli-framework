import type {
  ServiceInfo,
  ServiceProvider,
} from "../../api/service/ServiceProvider.ts";
import DefaultSyntaxHighlighterService from "./DefaultSyntaxHighlighterService.ts";
import {
  SYNTAX_HIGHLIGHTER_SERVICE_ID,
} from "../../api/service/core/SyntaxHighlighterService.ts";
import type Context from "../../api/Context.ts";
import type PrinterService from "../../api/service/core/PrinterService.ts";
import { PRINTER_SERVICE_ID } from "../../api/service/core/PrinterService.ts";
import type CLIConfig from "../../api/CLIConfig.ts";

/**
 * Provides a {@link SyntaxHighlighterService}.
 */
export default class SyntaxHighlighterServiceProvider
  implements ServiceProvider {
  readonly serviceId: string = SYNTAX_HIGHLIGHTER_SERVICE_ID;
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
