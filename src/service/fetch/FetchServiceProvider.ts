import type {
  CLIConfig,
  Context,
  ServiceInfo,
  ServiceProvider,
} from "@flowscripter/dynamic-cli-framework-api";
import { FETCH_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultFetchService from "./DefaultFetchService.ts";

export default class FetchServiceProvider implements ServiceProvider {
  readonly serviceId: string = FETCH_SERVICE_ID;
  readonly servicePriority: number;
  #fetchService: DefaultFetchService | undefined;

  public constructor(servicePriority: number) {
    this.servicePriority = servicePriority;
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    this.#fetchService = new DefaultFetchService();
    return Promise.resolve({
      service: this.#fetchService,
      commands: [],
    });
  }

  public initService(context: Context): Promise<void> {
    this.#fetchService!.setContext(context);
    return Promise.resolve();
  }
}
