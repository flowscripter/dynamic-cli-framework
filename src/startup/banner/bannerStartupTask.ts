import type { Context, PrinterService, StartupTask } from "@flowscripter/dynamic-cli-framework-api";
import {
  ASCII_BANNER_GENERATOR_SERVICE_ID,
  CONFIGURATION_SERVICE_ID,
  PRINTER_SERVICE_ID,
  UPGRADE_SERVICE_ID,
} from "@flowscripter/dynamic-cli-framework-api";
import type { AsciiBannerGeneratorService } from "@flowscripter/dynamic-cli-framework-api";
import type { ConfigurationService } from "@flowscripter/dynamic-cli-framework-api";
import DefaultUpgradeService from "../../service/upgrade/DefaultUpgradeService.ts";
import NoBannerCommand, { type BannerState } from "./command/NoBannerCommand.ts";

export const BANNER_STARTUP_TASK_ID = "@flowscripter/dynamic-cli-framework/banner-startup-task";

/**
 * Build the ascii banner {@link StartupTask}.
 *
 * A consumer opts in by passing the result of this function in the `serviceProviders` array
 * argument of {@link launchMultiCommandCLI}/{@link launchSingleCommandCLI} (or via
 * `BaseCLI.addStartupTask`) - there's no default/automatic banner registration.
 *
 * @param priority the priority of the task (higher runs earlier). It must be above
 * `AUTO_UPGRADE_STARTUP_TASK_PRIORITY` (10) for the banner to print before the automatic upgrade
 * prompt and upgrade.
 * @param fontName an optional [FIGlet](http://www.figlet.org) font name to use for the banner,
 * defaults to "standard".
 */
export default function createBannerStartupTask(
  priority: number,
  fontName = "standard",
): StartupTask {
  const state: BannerState = { printBanner: true };

  return {
    id: BANNER_STARTUP_TASK_ID,
    priority,
    mode: "blocking",
    modifierCommands: [new NoBannerCommand(state, priority)],
    run: async (context: Context): Promise<void> => {
      if (!state.printBanner) {
        return;
      }

      const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;

      const asciiBannerGeneratorService = context.getServiceById(
        ASCII_BANNER_GENERATOR_SERVICE_ID,
      ) as AsciiBannerGeneratorService;

      const { cliConfig } = context;
      const bannerText = await asciiBannerGeneratorService.generate(cliConfig.name.toUpperCase(), {
        fontName,
        subMessage: cliConfig.subMessage,
      });

      await printerService.info(printerService.blue(bannerText));
      if (cliConfig.description !== undefined) {
        await printerService.info(`  ${printerService.primary(cliConfig.description)}\n`);
      }
      if (cliConfig.version.length > 0) {
        let versionLine = "version: " + cliConfig.version;
        // Cheap cache read only - never calls checkForUpgrade()/getUpgradeCheckResult() live,
        // since that could stall startup on a network/spawn call. A first-ever run (no cached
        // result yet) shows no upgrade-available suffix. The cached result is read through the
        // upgrade service because it is stored in that service's own KeyValueService scope, and
        // it is ignored if it was recorded by a different version (e.g. before an upgrade).
        const upgradeService = context.doesServiceExist(UPGRADE_SERVICE_ID)
          ? context.getServiceById(UPGRADE_SERVICE_ID)
          : undefined;
        if (upgradeService instanceof DefaultUpgradeService) {
          const result = await upgradeService.getCachedUpgradeCheckResult();
          if (
            result?.status === "checked" &&
            result.updateAvailable &&
            result.currentVersion === cliConfig.version
          ) {
            versionLine += ` (${result.latestVersion} available, run '${cliConfig.name} upgrade')`;
          }
        }
        await printerService.info(`  ${printerService.secondary(versionLine)}\n`);
      }
      if (context.doesServiceExist(CONFIGURATION_SERVICE_ID)) {
        const configurationService = context.getServiceById(
          CONFIGURATION_SERVICE_ID,
        ) as ConfigurationService;
        const configLocation = configurationService.configLocation;
        if (configLocation && configLocation.length > 0) {
          await printerService.info(`  ${printerService.secondary("config: " + configLocation)}\n`);
        }
      }
      await printerService.info("\n");
    },
  };
}
