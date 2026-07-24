import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Option } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import {
  type ArgumentValues,
  ArgumentValueTypeName,
} from "@flowscripter/dynamic-cli-framework-api";
import {
  Icon,
  InstallMethod,
  PRINTER_SERVICE_ID,
  SupportedArch,
  SupportedOs,
} from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import type DefaultUpgradeService from "../DefaultUpgradeService.ts";

export class UpgradeSubCommand implements SubCommand {
  readonly name = "upgrade";
  readonly description = "Upgrade to the latest available version";
  readonly enableConfiguration = false;
  readonly positionals = [];

  readonly options: ReadonlyArray<Option> = [
    {
      name: "os",
      type: ArgumentValueTypeName.STRING,
      isOptional: true,
      allowableValues: Object.values(SupportedOs),
      description: "Override the detected operating system",
    },
    {
      name: "install-method",
      type: ArgumentValueTypeName.STRING,
      isOptional: true,
      allowableValues: Object.values(InstallMethod),
      description: "Override the detected install method",
    },
  ];

  readonly #upgradeService: DefaultUpgradeService;

  public constructor(upgradeService: DefaultUpgradeService) {
    this.#upgradeService = upgradeService;
  }

  public async execute(context: Context, argumentValues: ArgumentValues): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const cliName = context.cliConfig.name;

    const os = argumentValues.os as SupportedOs | undefined;
    const arch = undefined as SupportedArch | undefined;
    const installMethod = argumentValues["install-method"] as InstallMethod | undefined;

    const checkResult =
      os === undefined && installMethod === undefined
        ? await this.#upgradeService.getUpgradeCheckResult(true)
        : await this.#upgradeService.checkForUpgrade(os, arch, installMethod);
    if (!checkResult) {
      await printerService.error(
        `No upgrade location is configured for the detected or requested platform.\n`,
        Icon.FAILURE,
      );
      return;
    }

    if (!checkResult.updateAvailable) {
      await printerService.print(
        `${cliName} is already up to date (${checkResult.currentVersion}).\n`,
      );
      return;
    }

    const upgradeResult = await this.#upgradeService.upgrade(os, arch, installMethod);
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
