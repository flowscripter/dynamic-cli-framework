import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import DefaultSyntaxHighlighterService from "./DefaultSyntaxHighlighterService.ts";
import { SYNTAX_HIGHLIGHTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";

/**
 * Provides a {@link SyntaxHighlighterService}.
 */
export default class SyntaxHighlighterServiceProvider implements ServiceProvider {
  readonly serviceId: string = SYNTAX_HIGHLIGHTER_SERVICE_ID;
  readonly #defaultSyntaxHighlighterService: DefaultSyntaxHighlighterService;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   */
  public constructor(readonly servicePriority: number) {
    this.#defaultSyntaxHighlighterService = new DefaultSyntaxHighlighterService();
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#defaultSyntaxHighlighterService,
      commands: [],
    });
  }

  initService(context: Context): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;

    this.#defaultSyntaxHighlighterService.colorEnabled = printerService.colorEnabled;
    this.#defaultSyntaxHighlighterService.colorFunction = printerService.color.bind(printerService);

    return Promise.resolve(undefined);
  }
}
