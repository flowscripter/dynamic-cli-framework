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
import { FETCH_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { FetchService } from "@flowscripter/dynamic-cli-framework-api";
import { Icon, PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import DefaultUpgradeService from "./DefaultUpgradeService.ts";
import { UpgradeSubCommand } from "./command/UpgradeSubCommand.ts";
import type { UpgradeLocationsConfig } from "./UpgradeLocationsConfig.ts";
import getLogger from "../../util/logger.ts";
import type { StartupTask } from "@flowscripter/dynamic-cli-framework-api";

const logger = getLogger("UpgradeServiceProvider");

/**
 * Build the background {@link StartupTask} which opportunistically refreshes the upgrade-check
 * cache (see {@link DefaultUpgradeService.refreshUpgradeCheckCache}) that the banner task reads
 * from. Registered separately from {@link UpgradeServiceProvider} itself (which still runs as a
 * regular blocking init task) so it can run in `"background"` mode.
 */
export function createUpgradeCheckStartupTask(
  upgradeService: DefaultUpgradeService,
  priority: number,
): StartupTask {
  return {
    id: `${UPGRADE_SERVICE_ID}-check`,
    priority,
    mode: "background",
    run: async () => {
      await upgradeService.refreshUpgradeCheckCache();
    },
  };
}

/**
 * Build the blocking {@link StartupTask} which offers to enable automatic upgrades and, when they
 * are enabled, checks for and installs a newer version (see
 * {@link UpgradeServiceProvider.runAutoUpgrade}). It is registered separately from the provider's
 * own init task so it can run at a lower priority, after consumer startup tasks such as the banner.
 */
export function createAutoUpgradeStartupTask(
  provider: UpgradeServiceProvider,
  priority: number,
): StartupTask {
  return {
    id: `${UPGRADE_SERVICE_ID}-auto-upgrade`,
    priority,
    mode: "blocking",
    run: (context: Context) => provider.runAutoUpgrade(context),
  };
}

export default class UpgradeServiceProvider implements ServiceProvider {
  readonly serviceId: string = UPGRADE_SERVICE_ID;
  readonly servicePriority: number;
  readonly #config: UpgradeLocationsConfig;
  #upgradeService: DefaultUpgradeService | undefined;
  #cliConfig: CLIConfig | undefined;
  #keyValueService: KeyValueService | undefined;

  public constructor(servicePriority: number, config: UpgradeLocationsConfig) {
    this.servicePriority = servicePriority;
    this.#config = config;
  }

  public get upgradeService(): DefaultUpgradeService | undefined {
    return this.#upgradeService;
  }

  public getServiceInfo(cliConfig: CLIConfig): Promise<ServiceInfo> {
    this.#cliConfig = cliConfig;
    this.#upgradeService = new DefaultUpgradeService(this.#config, cliConfig);
    return Promise.resolve({
      service: this.#upgradeService,
      commands: [new UpgradeSubCommand()],
    });
  }

  public initService(context: Context): Promise<void> {
    const upgradeService = this.#upgradeService!;

    const spawnService = context.doesServiceExist(SPAWN_SERVICE_ID)
      ? (context.getServiceById(SPAWN_SERVICE_ID) as SpawnService)
      : undefined;
    const fetchService = context.doesServiceExist(FETCH_SERVICE_ID)
      ? (context.getServiceById(FETCH_SERVICE_ID) as FetchService)
      : undefined;
    if (spawnService === undefined) {
      logger.debug(() => "SpawnService not available, upgrade install methods will be unavailable");
    }
    if (fetchService === undefined) {
      logger.debug(() => "FetchService not available, upgrade version checks will be unavailable");
    }
    // the KeyValueService from this context is bound to the upgrade service's own scope, so it is
    // kept for runAutoUpgrade(), whose task context is scoped to the task ID instead
    this.#keyValueService = context.doesServiceExist(KEY_VALUE_SERVICE_ID)
      ? (context.getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService)
      : undefined;
    upgradeService.setContext(context);
    return Promise.resolve();
  }

  /**
   * Offer to enable automatic upgrades (storing the answer as `upgrade-status` in the upgrade
   * service's scope) and, when they are enabled, check for and install a newer version. Must be
   * called after {@link initService}.
   *
   * @param context the startup task's context, used to look up the Prompter and Printer services.
   */
  public async runAutoUpgrade(context: Context): Promise<void> {
    const upgradeService = this.#upgradeService!;
    const cliConfig = this.#cliConfig!;
    const keyValueService = this.#keyValueService;

    if (!context.doesServiceExist(PROMPTER_SERVICE_ID)) {
      logger.debug(() => "PrompterService not available, skipping auto-upgrade");
      return;
    }
    if (!keyValueService) {
      logger.debug(() => "KeyValueService not available, skipping auto-upgrade");
      return;
    }

    if (await keyValueService.has("upgrade-status")) {
      const status = await keyValueService.get("upgrade-status");
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
      await keyValueService.set("upgrade-status", "declined");
      return;
    }

    await keyValueService.set("upgrade-status", "enabled");
    await this.#checkAndUpgrade(context, upgradeService, cliConfig);
  }

  async #checkAndUpgrade(
    context: Context,
    upgradeService: DefaultUpgradeService,
    cliConfig: CLIConfig,
  ): Promise<void> {
    try {
      const checkResult = await upgradeService.getUpgradeCheckResult();
      if (checkResult.status === "failed") {
        logger.debug(() => `Auto-upgrade check failed: ${checkResult.error.message}`);
        return;
      }
      if (checkResult.status !== "checked" || !checkResult.updateAvailable) {
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
