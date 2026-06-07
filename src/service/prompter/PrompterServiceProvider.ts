import type Context from "../../api/Context.ts";
import type { ServiceInfo, ServiceProvider } from "../../api/service/ServiceProvider.ts";
import type PrompterService from "../../api/service/core/PrompterService.ts";
import { PROMPTER_SERVICE_ID } from "../../api/service/core/PrompterService.ts";
import NoPromptCommand from "./command/NoPromptCommand.ts";
import type CLIConfig from "../../api/CLIConfig.ts";

export default class PrompterServiceProvider implements ServiceProvider {
  readonly serviceId: string = PROMPTER_SERVICE_ID;
  readonly servicePriority: number;
  readonly prompterService: PrompterService;

  public constructor(servicePriority: number, prompterService: PrompterService) {
    this.servicePriority = servicePriority;
    this.prompterService = prompterService;
  }

  public getServiceInfo(_cliConfig: CLIConfig): Promise<ServiceInfo> {
    return Promise.resolve({
      service: this.prompterService,
      commands: [new NoPromptCommand(this, this.servicePriority)],
    });
  }

  initService(_context: Context): Promise<void> {
    return Promise.resolve();
  }
}
