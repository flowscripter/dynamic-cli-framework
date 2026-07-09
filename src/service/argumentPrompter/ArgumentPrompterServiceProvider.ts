import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { ArgumentPrompterService } from "@flowscripter/dynamic-cli-framework-api";
import { ARGUMENT_PROMPTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";

export default class ArgumentPrompterServiceProvider implements ServiceProvider {
  readonly serviceId: string = ARGUMENT_PROMPTER_SERVICE_ID;
  readonly servicePriority: number;
  readonly argumentPrompterService: ArgumentPrompterService;

  public constructor(servicePriority: number, argumentPrompterService: ArgumentPrompterService) {
    this.servicePriority = servicePriority;
    this.argumentPrompterService = argumentPrompterService;
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.argumentPrompterService,
      commands: [],
    });
  }

  initService(_context: Context): Promise<void> {
    return Promise.resolve();
  }
}
