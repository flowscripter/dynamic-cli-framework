import ServiceProvider, {
  ServiceInfo,
} from "../../api/service/ServiceProvider.ts";
import DefaultShutdownService from "./DefaultShutdownService.ts";
import ShutdownService, {
  SHUTDOWN_SERVICE_ID,
} from "../../api/service/core/ShutdownService.ts";
import Context from "../../api/Context.ts";
import getLogger from "../../util/logger.ts";
import CLIConfig from "../../api/CLIConfig.ts";

const logger = getLogger("ShutdownServiceProvider");

/**
 * Provides a {@link ShutdownService}.
 */
export default class ShutdownServiceProvider implements ServiceProvider {
  readonly serviceId = SHUTDOWN_SERVICE_ID;
  readonly servicePriority: number;
  readonly shutdownService: ShutdownService;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   */
  public constructor(
    servicePriority: number,
  ) {
    this.servicePriority = servicePriority;
    this.shutdownService = new DefaultShutdownService();
    Deno.addSignalListener("SIGINT", ShutdownServiceProvider.shutdown);
  }

  public provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.shutdownService,
      commands: [],
    });
  }

  initService(_context: Context): Promise<void> {
    return Promise.resolve(undefined);
  }

  static shutdown() {
    try {
      DefaultShutdownService.callbacks.forEach((callback) => callback());
      Deno.removeSignalListener("SIGINT", ShutdownServiceProvider.shutdown);
    } catch (error) {
      logger.error("shutdown error: %s", error.message);
    }
  }
}