import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import { PROMPTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import NoPromptCommand from "./command/NoPromptCommand.ts";
import type { CLIConfig, PrompterService } from "@flowscripter/dynamic-cli-framework-api";
import DefaultPrompterService from "./DefaultPrompterService.ts";

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
      commands: [new NoPromptCommand(this.servicePriority)],
    });
  }

  initService(context: Context): Promise<void> {
    if (this.prompterService instanceof DefaultPrompterService) {
      this.prompterService.setContext(context);
    }
    return Promise.resolve();
  }
}
