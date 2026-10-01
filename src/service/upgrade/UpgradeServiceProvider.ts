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
import type { StartupTask, StartupTaskOutcome } from "@flowscripter/dynamic-cli-framework-api";

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
 * are enabled, checks for and installs a newer version, optionally restarting into it (see
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
  readonly #restartAfterAutoUpgrade: boolean;
  #restartArgs: ReadonlyArray<string> = [];

  /**
   * @param servicePriority the priority of the service.
   * @param config the upgrade locations.
   * @param restartAfterAutoUpgrade whether to run the upgraded executable, with the arguments from
   * {@link setRestartArgs}, after a successful automatic upgrade and end the run with its result.
   */
  public constructor(
    servicePriority: number,
    config: UpgradeLocationsConfig,
    restartAfterAutoUpgrade = false,
  ) {
    this.servicePriority = servicePriority;
    this.#config = config;
    this.#restartAfterAutoUpgrade = restartAfterAutoUpgrade;
  }

  /**
   * Set the CLI arguments to run the upgraded executable with when restarting after an automatic
   * upgrade. These are kept internal to the framework and never exposed to startup tasks.
   */
  public setRestartArgs(args: ReadonlyArray<string>): void {
    this.#restartArgs = args;
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
   * After a successful upgrade, when restarting is enabled, the upgraded executable is run with the
   * arguments from {@link setRestartArgs} and its result is returned as an `exitRequest`. Does
   * nothing in a process which was itself started by such a restart.
   *
   * @param context the startup task's context, used to look up the Prompter and Printer services.
   */
  public async runAutoUpgrade(context: Context): Promise<void | StartupTaskOutcome> {
    const upgradeService = this.#upgradeService!;
    const cliConfig = this.#cliConfig!;
    const keyValueService = this.#keyValueService;

    if (upgradeService.restartedFromVersion !== undefined) {
      logger.debug(
        () =>
          `Restarted from version ${upgradeService.restartedFromVersion}, skipping auto-upgrade`,
      );
      return;
    }

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
        return this.#checkAndUpgrade(context, upgradeService, cliConfig, keyValueService);
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
    return this.#checkAndUpgrade(context, upgradeService, cliConfig, keyValueService);
  }

  async #checkAndUpgrade(
    context: Context,
    upgradeService: DefaultUpgradeService,
    cliConfig: CLIConfig,
    keyValueService: KeyValueService,
  ): Promise<void | StartupTaskOutcome> {
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
      const printerService = context.doesServiceExist(PRINTER_SERVICE_ID)
        ? (context.getServiceById(PRINTER_SERVICE_ID) as PrinterService)
        : undefined;
      if (!upgradeResult.ok) {
        await printerService?.error(
          `Auto-upgrade failed: ${upgradeResult.error?.message ?? "unknown error"}\n`,
          Icon.FAILURE,
        );
        return;
      }
      await printerService?.info(
        `${cliConfig.name} upgraded (${upgradeResult.oldVersion} -> ${upgradeResult.newVersion})\n`,
        Icon.SUCCESS,
      );
      if (!this.#restartAfterAutoUpgrade) {
        return;
      }

      const executable = upgradeService.resolveUpgradedExecutable(checkResult.installMethod);
      if (executable === undefined) {
        await printerService?.info(
          `Restart ${cliConfig.name} to use ${upgradeResult.newVersion}\n`,
          Icon.INFORMATION,
        );
        return;
      }

      // the cache write from the background upgrade check lands before the flush, so the shutdown
      // flush has nothing left to write over the restarted process's configuration
      await upgradeService.refreshUpgradeCheckCache();
      // written now so the restarted process sees the stored upgrade-status
      await keyValueService.flush();
      const runState = await upgradeService.restart(executable, this.#restartArgs);
      if (runState !== undefined) {
        return { exitRequest: { runState } };
      }
      await printerService?.warn(
        `${cliConfig.name} upgraded to ${upgradeResult.newVersion}; restart it to use the new version\n`,
        Icon.ALERT,
      );
    } catch (error) {
      logger.debug(() => `Auto-upgrade check failed: ${error}`);
    }
  }
}
