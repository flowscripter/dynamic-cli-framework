import type {
  Context,
  KeyValueService,
  PrinterService,
  StartupTask,
  UpgradeCheckResult,
} from "@flowscripter/dynamic-cli-framework-api";
import {
  ASCII_BANNER_GENERATOR_SERVICE_ID,
  KEY_VALUE_SERVICE_ID,
  PRINTER_SERVICE_ID,
} from "@flowscripter/dynamic-cli-framework-api";
import type { AsciiBannerGeneratorService } from "@flowscripter/dynamic-cli-framework-api";
import {
  CONFIG_LOCATION_SERVICE_ID,
  type ConfigLocationService,
} from "../../service/configuration/ConfigurationServiceProvider.ts";
import { UPGRADE_CHECK_CACHE_KEY } from "../../service/upgrade/DefaultUpgradeService.ts";
import NoBannerCommand, { type BannerState } from "./command/NoBannerCommand.ts";

export const BANNER_STARTUP_TASK_ID = "@flowscripter/dynamic-cli-framework/banner-startup-task";

/**
 * Build the ascii banner {@link StartupTask}, replacing the old `BannerServiceProvider`.
 *
 * A consumer opts in by passing the result of this function in the `serviceProviders` array
 * argument of {@link launchMultiCommandCLI}/{@link launchSingleCommandCLI} (or via
 * `BaseCLI.addStartupTask`), the same way `new BannerServiceProvider(priority)` used to be passed
 * in that array - there's no default/automatic banner registration.
 *
 * @param priority the priority of the task (higher runs earlier - the same semantics
 * `BannerServiceProvider.servicePriority` had).
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
        // key yet) simply shows no upgrade-available suffix - that's expected, not a bug.
        if (context.doesServiceExist(KEY_VALUE_SERVICE_ID)) {
          const keyValueService = context.getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService;
          if (await keyValueService.has(UPGRADE_CHECK_CACHE_KEY)) {
            const result = (await keyValueService.get(
              UPGRADE_CHECK_CACHE_KEY,
            )) as unknown as UpgradeCheckResult;
            if (result.status === "checked" && result.updateAvailable) {
              versionLine += ` (${result.latestVersion} available, run '${cliConfig.name} upgrade')`;
            }
          }
        }
        await printerService.info(`  ${printerService.secondary(versionLine)}\n`);
      }
      if (context.doesServiceExist(CONFIG_LOCATION_SERVICE_ID)) {
        const configLocationService = context.getServiceById(
          CONFIG_LOCATION_SERVICE_ID,
        ) as ConfigLocationService;
        const configLocation = configLocationService.configLocation;
        if (configLocation && configLocation.length > 0) {
          await printerService.info(`  ${printerService.secondary("config: " + configLocation)}\n`);
        }
      }
      await printerService.info("\n");
    },
  };
}
