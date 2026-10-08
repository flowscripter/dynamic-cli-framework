import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Option } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import { type Values, ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import {
  Icon,
  InstallMethod,
  PRINTER_SERVICE_ID,
  UPGRADE_SERVICE_ID,
} from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import type { UpgradeService } from "@flowscripter/dynamic-cli-framework-api";

function installMethodsForPlatform(): InstallMethod[] {
  if (process.platform === "darwin") {
    return [InstallMethod.HOMEBREW, InstallMethod.GITHUB_RELEASE];
  }
  if (process.platform === "linux") {
    return [InstallMethod.LINUX_SCRIPT, InstallMethod.GITHUB_RELEASE];
  }
  if (process.platform === "win32") {
    return [InstallMethod.WINGET, InstallMethod.GITHUB_RELEASE];
  }
  return [InstallMethod.GITHUB_RELEASE];
}

export class UpgradeSubCommand implements SubCommand {
  readonly name = "upgrade";
  readonly description = "Upgrade to the latest available version";
  readonly enableConfiguration = false;
  readonly positionals = [];

  readonly options: ReadonlyArray<Option> = [
    {
      name: "install-method",
      type: ValueTypeName.STRING,
      isOptional: true,
      allowableValues: installMethodsForPlatform(),
      description: "Override the detected install method",
    },
  ];

  public async execute(context: Context, argumentValues: Values): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const upgradeService = context.getServiceById(UPGRADE_SERVICE_ID) as UpgradeService;
    const cliName = context.cliConfig.name;
    const currentVersion = context.cliConfig.version;

    const installMethod = argumentValues["install-method"] as InstallMethod | undefined;

    await printerService.showSpinner(`Looking for version newer than ${currentVersion}`);

    const checkResult =
      installMethod === undefined
        ? await upgradeService.refreshUpgradeCheckCache()
        : await upgradeService.checkForUpgrade(installMethod);

    await printerService.hideSpinner();
    if (checkResult.status === "unsupported") {
      await printerService.error(
        `No upgrade location is configured for the detected platform.\n`,
        Icon.FAILURE,
      );
      return;
    }

    if (checkResult.status === "failed") {
      await printerService.error(
        `Failed to check for updates: ${checkResult.error.message}. Please try again later.\n`,
        Icon.FAILURE,
      );
      return;
    }

    if (!checkResult.updateAvailable) {
      await printerService.print(
        `${cliName} is already up to date: ${checkResult.currentVersion}\n`,
        Icon.INFORMATION,
      );
      return;
    }

    const upgradeResult = await upgradeService.upgrade(installMethod);
    if (!upgradeResult.ok) {
      await printerService.error(
        `Failed to upgrade ${cliName}: ${upgradeResult.error?.message ?? "unknown error"}\n`,
        Icon.FAILURE,
      );
      return;
    }

    await printerService.print(
      `${cliName} upgraded (${upgradeResult.oldVersion} -> ${upgradeResult.newVersion})\n`,
      Icon.SUCCESS,
    );
  }
}
