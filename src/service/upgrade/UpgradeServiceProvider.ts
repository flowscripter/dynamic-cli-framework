import type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import { UPGRADE_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { PROMPTER_SERVICE_ID, PromptType } from "@flowscripter/dynamic-cli-framework-api";
import type { PrompterService } from "@flowscripter/dynamic-cli-framework-api";
import { KEY_VALUE_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { KeyValueService } from "@flowscripter/dynamic-cli-framework-api";
import { SPAWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { SpawnService } from "@flowscripter/dynamic-cli-framework-api";
import { SHUTDOWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { ShutdownService } from "@flowscripter/dynamic-cli-framework-api";
import { Icon, PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import DefaultUpgradeService from "./DefaultUpgradeService.ts";
import { UpgradeSubCommand } from "./command/UpgradeSubCommand.ts";
import type { UpgradeLocationsConfig } from "./UpgradeLocationsConfig.ts";
import getLogger from "../../util/logger.ts";

const logger = getLogger("UpgradeServiceProvider");

export default class UpgradeServiceProvider implements ServiceProvider {
  readonly serviceId: string = UPGRADE_SERVICE_ID;
  readonly servicePriority: number;
  readonly #config: UpgradeLocationsConfig;
  #upgradeService: DefaultUpgradeService | undefined;
  #cliConfig: CLIConfig | undefined;

  public constructor(servicePriority: number, config: UpgradeLocationsConfig) {
    this.servicePriority = servicePriority;
    this.#config = config;
  }

  public getServiceInfo(cliConfig: CLIConfig): Promise<ServiceInfo> {
    this.#cliConfig = cliConfig;
    this.#upgradeService = new DefaultUpgradeService(this.#config, cliConfig);
    return Promise.resolve({
      service: this.#upgradeService,
      commands: [new UpgradeSubCommand(this.#upgradeService)],
    });
  }

  public async initService(context: Context): Promise<void> {
    const upgradeService = this.#upgradeService!;
    const cliConfig = this.#cliConfig!;

    if (context.doesServiceExist(SPAWN_SERVICE_ID)) {
      const spawnService = context.getServiceById(SPAWN_SERVICE_ID) as SpawnService;
      const shutdownService = context.doesServiceExist(SHUTDOWN_SERVICE_ID)
        ? (context.getServiceById(SHUTDOWN_SERVICE_ID) as ShutdownService)
        : undefined;
      upgradeService.setDependencies(spawnService, shutdownService);
    } else {
      logger.debug(() => "SpawnService not available, upgrade install methods will be unavailable");
    }

    if (!context.doesServiceExist(PROMPTER_SERVICE_ID)) {
      logger.debug(() => "PrompterService not available, skipping auto-upgrade");
      return;
    }
    if (!context.doesServiceExist(KEY_VALUE_SERVICE_ID)) {
      logger.debug(() => "KeyValueService not available, skipping auto-upgrade");
      return;
    }

    const keyValueService = context.getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService;

    if (await keyValueService.hasKey("upgrade-status")) {
      const status = await keyValueService.getKey("upgrade-status");
      if (status === "declined") {
        logger.debug(() => "Auto-upgrade previously declined, skipping");
        return;
      }
      if (status === "enabled") {
        await this.#checkAndUpgrade(context, upgradeService, cliConfig);
        return;
      }
    }

    const prompterService = context.getServiceById(PROMPTER_SERVICE_ID) as PrompterService;
    if (!prompterService.promptEnabled) {
      logger.debug(() => "Prompting is disabled, skipping auto-upgrade prompt");
      return;
    }

    const os = upgradeService.detectOs();
    const arch = upgradeService.detectArch();
    if (!os || !arch) {
      logger.debug(() => "Unsupported OS/arch, skipping auto-upgrade prompt");
      return;
    }
    const installMethod = await upgradeService.detectInstallMethod(os);
    if (!installMethod) {
      logger.debug(() => "No supported install method detected, skipping auto-upgrade prompt");
      return;
    }

    let enableResult;
    try {
      enableResult = await prompterService.prompt({
        name: "enable-upgrade",
        promptText: "Would you like to enable automatic upgrades on startup?",
        description:
          "This will check for and install newer versions of " +
          `${cliConfig.name} before it runs each time.`,
        type: PromptType.TOGGLE,
        options: [
          { displayValue: "Yes", returnedValue: true },
          { displayValue: "No", returnedValue: false },
        ],
      });
    } catch {
      return;
    }

    if (enableResult.value !== true) {
      await keyValueService.setKey("upgrade-status", "declined");
      return;
    }

    await keyValueService.setKey("upgrade-status", "enabled");
    await this.#checkAndUpgrade(context, upgradeService, cliConfig);
  }

  async #checkAndUpgrade(
    context: Context,
    upgradeService: DefaultUpgradeService,
    cliConfig: CLIConfig,
  ): Promise<void> {
    try {
      const checkResult = await upgradeService.checkForUpgrade();
      if (!checkResult?.updateAvailable) {
        return;
      }
      const upgradeResult = await upgradeService.upgrade();
      if (!context.doesServiceExist(PRINTER_SERVICE_ID)) {
        return;
      }
      const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
      if (upgradeResult.ok) {
        await printerService.info(
          `${cliConfig.name} upgraded (${upgradeResult.oldVersion} -> ${upgradeResult.newVersion})\n`,
          Icon.SUCCESS,
        );
      } else {
        await printerService.error(
          `Auto-upgrade failed: ${upgradeResult.error?.message ?? "unknown error"}\n`,
          Icon.FAILURE,
        );
      }
    } catch (error) {
      logger.debug(() => `Auto-upgrade check failed: ${error}`);
    }
  }
}
