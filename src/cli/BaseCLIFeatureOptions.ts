import type { UpgradeLocationsConfig } from "../service/upgrade/UpgradeLocationsConfig.ts";
import type {
  NpmjsPluginRepositoryConfig,
  NpmPluginRepositoryConfig,
} from "@flowscripter/dynamic-plugin-framework";

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
  /**
   * When an automatic upgrade on startup succeeds, run the upgraded executable with the same
   * arguments and end this run with its result, rather than continuing on the old version.
   */
  readonly restartAfterAutoUpgrade?: boolean;
  readonly pluginServiceEnabled?: boolean;
  readonly pluginServiceRemoteConfig?: NpmjsPluginRepositoryConfig;
  readonly pluginServiceLocalConfig?: NpmPluginRepositoryConfig;
  readonly validateAllCommands?: boolean;
  readonly promptingEnabled?: boolean;
}
