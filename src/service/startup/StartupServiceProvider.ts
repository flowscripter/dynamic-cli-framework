import type {
  CLIConfig,
  Context,
  ServiceInfo,
  ServiceProvider,
} from "@flowscripter/dynamic-cli-framework-api";
import { STARTUP_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultStartupService from "./DefaultStartupService.ts";

/**
 * Minimal internal {@link ServiceProvider} which registers a {@link DefaultStartupService} in the
 * {@link Context}. There is no natural per-provider work for this service to do on init - tasks
 * registered against it are run by the {@link run} orchestration loop directly, not via
 * {@link initService}.
 */
export default class StartupServiceProvider implements ServiceProvider {
  readonly serviceId: string = STARTUP_SERVICE_ID;
  readonly servicePriority: number;
  readonly startupService: DefaultStartupService;

  public constructor(servicePriority: number) {
    this.servicePriority = servicePriority;
    this.startupService = new DefaultStartupService();
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.startupService,
      commands: [],
    });
  }

  public initService(_context: Context): Promise<void> {
    return Promise.resolve();
  }
}
