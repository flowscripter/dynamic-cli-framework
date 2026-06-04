import type { ServiceProvider } from "../../api/service/ServiceProvider.ts";
import type { ServiceInfo } from "../../api/service/ServiceProvider.ts";
import type CLIConfig from "../../api/CLIConfig.ts";
import type Context from "../../api/Context.ts";
import { COMPLETION_SERVICE_ID } from "../../api/service/core/CompletionService.ts";
import { ShellType } from "../../api/service/core/CompletionService.ts";
import type DefaultCompletionService from "./DefaultCompletionService.ts";
import { PROMPTER_SERVICE_ID } from "../../api/service/core/PrompterService.ts";
import { PromptType } from "../../api/service/core/PrompterService.ts";
import type PrompterService from "../../api/service/core/PrompterService.ts";
import { KEY_VALUE_SERVICE_ID } from "../../api/service/core/KeyValueService.ts";
import type KeyValueService from "../../api/service/core/KeyValueService.ts";
import {
  Icon,
  PRINTER_SERVICE_ID,
} from "../../api/service/core/PrinterService.ts";
import type PrinterService from "../../api/service/core/PrinterService.ts";
import getLogger from "../../util/logger.ts";

const logger = getLogger("CompletionServiceProvider");

export default class CompletionServiceProvider implements ServiceProvider {
  readonly serviceId: string = COMPLETION_SERVICE_ID;
  readonly servicePriority: number;
  readonly #completionService: DefaultCompletionService;
  #cliName = "";

  public constructor(
    servicePriority: number,
    completionService: DefaultCompletionService,
  ) {
    this.servicePriority = servicePriority;
    this.#completionService = completionService;
  }

  public getServiceInfo(cliConfig: CLIConfig): Promise<ServiceInfo> {
    this.#cliName = cliConfig.name;
    return Promise.resolve({
      service: this.#completionService,
      commands: [],
    });
  }

  public async initService(context: Context): Promise<void> {
    if (!context.doesServiceExist(PROMPTER_SERVICE_ID)) {
      logger.debug(() => "PrompterService not available, skipping auto-prompt");
      return;
    }
    if (!context.doesServiceExist(KEY_VALUE_SERVICE_ID)) {
      logger.debug(
        () => "KeyValueService not available, skipping auto-prompt",
      );
      return;
    }

    const keyValueService = context.getServiceById(
      KEY_VALUE_SERVICE_ID,
    ) as KeyValueService;
    if (await keyValueService.hasKey("completion-status")) {
      const status = await keyValueService.getKey("completion-status");
      if (status === "installed" || status === "declined") {
        logger.debug(
          () => `Completion status is '${status}', skipping auto-prompt`,
        );
        return;
      }
    }

    const prompterService = context.getServiceById(
      PROMPTER_SERVICE_ID,
    ) as PrompterService;
    if (!prompterService.promptEnabled) {
      logger.debug(() => "Prompting is disabled, skipping auto-prompt");
      return;
    }

    const enableResult = await prompterService.prompt({
      name: "enable-completion",
      promptText:
        "Would you like to enable autocompletion? This will set up your terminal so pressing TAB while typing commands will show possible options and autocomplete arguments. (Enabling autocompletion will modify configuration files in your home directory.)",
      type: PromptType.TOGGLE,
      options: [
        { displayValue: "Yes", returnedValue: true },
        { displayValue: "No", returnedValue: false },
      ],
    });

    if (enableResult.value !== true) {
      await keyValueService.setKey("completion-status", "declined");
      return;
    }

    const shellOptions = Object.values(ShellType).map((shell) => ({
      displayValue: shell,
      returnedValue: shell,
    }));

    const shellResult = await prompterService.prompt({
      name: "shell-type",
      promptText: "Which shell would you like to configure?",
      type: PromptType.SINGLE_SELECT,
      options: shellOptions,
    });

    const shellType = shellResult.value as ShellType;

    try {
      await this.#installCompletion(context, shellType);
      await keyValueService.setKey("completion-status", "installed");
    } catch (error) {
      logger.error(
        "Failed to install completion: %s",
        (error as Error).message,
      );
      if (context.doesServiceExist(PRINTER_SERVICE_ID)) {
        const printerService = context.getServiceById(
          PRINTER_SERVICE_ID,
        ) as PrinterService;
        await printerService.error(
          `Failed to install completion: ${(error as Error).message}`,
          Icon.FAILURE,
        );
      }
    }
  }

  async #installCompletion(
    context: Context,
    shellType: ShellType,
  ): Promise<void> {
    const isValid = await this.#completionService.validateShellEnvironment(
      shellType,
    );
    if (!isValid && context.doesServiceExist(PRINTER_SERVICE_ID)) {
      const printerService = context.getServiceById(
        PRINTER_SERVICE_ID,
      ) as PrinterService;
      await printerService.warn(
        `Shell '${shellType}' was not detected in the current environment. Proceeding anyway.\n`,
        Icon.ALERT,
      );
    }

    const configPath = this.#completionService.getDefaultConfigPath(shellType);
    const bootstrapScript = this.#completionService.getBootstrapScript(
      shellType,
      this.#cliName,
    );
    const beginMarker = `# BEGIN ${this.#cliName} completion`;
    const endMarker = `# END ${this.#cliName} completion`;
    const block = `${beginMarker}\n${bootstrapScript}\n${endMarker}`;

    let existingContent = "";
    try {
      existingContent = await Bun.file(configPath).text();
    } catch {
      // File doesn't exist yet
    }

    let newContent: string;
    const beginIdx = existingContent.indexOf(beginMarker);
    const endIdx = existingContent.indexOf(endMarker);
    if (beginIdx !== -1 && endIdx !== -1) {
      newContent = existingContent.substring(0, beginIdx) +
        block +
        existingContent.substring(endIdx + endMarker.length);
    } else {
      const separator = existingContent.length > 0 &&
          !existingContent.endsWith("\n")
        ? "\n\n"
        : existingContent.length > 0
        ? "\n"
        : "";
      newContent = existingContent + separator + block + "\n";
    }

    await Bun.write(configPath, newContent);

    if (context.doesServiceExist(PRINTER_SERVICE_ID)) {
      const printerService = context.getServiceById(
        PRINTER_SERVICE_ID,
      ) as PrinterService;
      await printerService.info(
        `Shell completion installed for ${shellType}. Restart your shell or run 'source ${configPath}' to activate.`,
        Icon.SUCCESS,
      );
    }
  }
}
