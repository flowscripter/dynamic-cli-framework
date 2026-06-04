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
import { shutdownState } from "./ShutdownState.ts";

const logger = getLogger("ShutdownServiceProvider");

export default class ShutdownServiceProvider implements ServiceProvider {
  readonly serviceId: string = SHUTDOWN_SERVICE_ID;
  readonly #shutdownService: ShutdownService;
  static #shutdownInProgress = false;

  public constructor(
    readonly servicePriority: number,
  ) {
    this.#shutdownService = new DefaultShutdownService();
    process.on("beforeExit", ShutdownServiceProvider.shutdown);
    process.on("SIGINT", ShutdownServiceProvider.onInterrupt);
    process.on("SIGTERM", ShutdownServiceProvider.onTerminate);
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.#shutdownService,
      commands: [],
    });
  }

  initService(_context: Context): Promise<void> {
    return Promise.resolve(undefined);
  }

  static onInterrupt(): void {
    shutdownState.interruptCount++;
    if (
      !shutdownState.longRunningMode || shutdownState.interruptCount >= 3
    ) {
      ShutdownServiceProvider.shutdown().then(() => {
        process.exit(130);
      });
    } else {
      shutdownState.shutdownRequested = true;
    }
  }

  static onTerminate(): void {
    ShutdownServiceProvider.shutdown().then(() => {
      process.exit(143);
    });
  }

  static async shutdown() {
    if (ShutdownServiceProvider.#shutdownInProgress) return;
    ShutdownServiceProvider.#shutdownInProgress = true;
    try {
      process.removeListener("beforeExit", ShutdownServiceProvider.shutdown);
      process.removeListener("SIGINT", ShutdownServiceProvider.onInterrupt);
      process.removeListener("SIGTERM", ShutdownServiceProvider.onTerminate);
      for await (const callback of DefaultShutdownService.callbacks) {
        await callback();
      }
    } catch (error) {
      logger.error("shutdown error: %s", (error as Error).message);
    }
  }
}
