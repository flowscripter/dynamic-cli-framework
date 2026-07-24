import type { UpgradeLocationsConfig } from "../service/upgrade/UpgradeLocationsConfig.ts";

export default interface BaseCLIFeatureOptions {
  readonly configFileSupportEnabled?: boolean;
  readonly envVarsSupportEnabled?: boolean;
  readonly keyValueServiceEnabled?: boolean;
  readonly secretServiceEnabled?: boolean;
  readonly argumentPrompterServiceEnabled?: boolean;
  readonly completionServiceEnabled?: boolean;
  readonly imagePrinterServiceEnabled?: boolean;
  readonly spawnServiceEnabled?: boolean;
  readonly fetchServiceEnabled?: boolean;
  readonly upgradeServiceEnabled?: boolean;
  readonly upgradeLocationsConfig?: UpgradeLocationsConfig;
  readonly validateAllCommands?: boolean;
  readonly promptingEnabled?: boolean;
}
