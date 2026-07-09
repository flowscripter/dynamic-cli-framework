import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { PrompterService } from "@flowscripter/dynamic-cli-framework-api";
import { PROMPTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import NoPromptCommand from "./command/NoPromptCommand.ts";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";

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
