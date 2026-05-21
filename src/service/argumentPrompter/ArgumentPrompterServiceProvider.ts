import type Context from "../../api/Context.ts";
import type {
  ServiceInfo,
  ServiceProvider,
} from "../../api/service/ServiceProvider.ts";
import type ArgumentPrompterService from "../../api/service/core/ArgumentPrompterService.ts";
import { ARGUMENT_PROMPTER_SERVICE_ID } from "../../api/service/core/ArgumentPrompterService.ts";
import type CLIConfig from "../../api/CLIConfig.ts";

export default class ArgumentPrompterServiceProvider
  implements ServiceProvider {
  readonly serviceId: string = ARGUMENT_PROMPTER_SERVICE_ID;
  readonly servicePriority: number;
  readonly argumentPrompterService: ArgumentPrompterService;

  public constructor(
    servicePriority: number,
    argumentPrompterService: ArgumentPrompterService,
  ) {
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
