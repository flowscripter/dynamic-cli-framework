import process from "node:process";
import type {
  ServiceInfo,
  ServiceProvider,
} from "../../api/service/ServiceProvider.ts";
import DefaultShutdownService from "./DefaultShutdownService.ts";
import type ShutdownService from "../../api/service/core/ShutdownService.ts";
import { SHUTDOWN_SERVICE_ID } from "../../api/service/core/ShutdownService.ts";
import type Context from "../../api/Context.ts";
import getLogger from "../../util/logger.ts";
import type CLIConfig from "../../api/CLIConfig.ts";

const logger = getLogger("ShutdownServiceProvider");

/**
 * Provides a {@link ShutdownService}.
 */
export default class ShutdownServiceProvider implements ServiceProvider {
  readonly serviceId: string = SHUTDOWN_SERVICE_ID;
  readonly #shutdownService: ShutdownService;

  /**
   * Create an instance of the service provider with the specified details.
   *
   * @param servicePriority the priority of the service.
   */
  public constructor(
    readonly servicePriority: number,
  ) {
    this.#shutdownService = new DefaultShutdownService();
    process.on("beforeExit", ShutdownServiceProvider.shutdown);
  }

  public provide(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#shutdownService,
      commands: [],
    });
  }

  initService(_context: Context): Promise<void> {
    return Promise.resolve(undefined);
  }

  static async shutdown() {
    try {
      process.removeListener("beforeExit", ShutdownServiceProvider.shutdown);
      for await (const callback of DefaultShutdownService.callbacks) {
        await callback();
      }
    } catch (error) {
      logger.error("shutdown error: %s", (error as Error).message);
    }
  }
}
