import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService, ShutdownService } from "@flowscripter/dynamic-cli-framework-api";
import { PRINTER_SERVICE_ID, SHUTDOWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { SPAWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultSpawnService from "./DefaultSpawnService.ts";

export default class SpawnServiceProvider implements ServiceProvider {
  readonly serviceId: string = SPAWN_SERVICE_ID;
  readonly servicePriority: number;
  #spawnService: DefaultSpawnService | undefined;

  public constructor(servicePriority: number) {
    this.servicePriority = servicePriority;
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    this.#spawnService = new DefaultSpawnService();
    return Promise.resolve({
      service: this.#spawnService,
      commands: [],
    });
  }

  public initService(context: Context): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const shutdownService = context.getServiceById(SHUTDOWN_SERVICE_ID) as ShutdownService;
    this.#spawnService!.setDependencies(printerService, shutdownService);
    return Promise.resolve();
  }
}
