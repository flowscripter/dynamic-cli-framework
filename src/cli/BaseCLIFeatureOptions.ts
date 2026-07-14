export default interface BaseCLIFeatureOptions {
  readonly configFileSupportEnabled?: boolean;
  readonly envVarsSupportEnabled?: boolean;
  readonly keyValueServiceEnabled?: boolean;
  readonly secretServiceEnabled?: boolean;
  readonly argumentPrompterServiceEnabled?: boolean;
  readonly completionServiceEnabled?: boolean;
  readonly imagePrinterServiceEnabled?: boolean;
  readonly spawnServiceEnabled?: boolean;
  readonly validateAllCommands?: boolean;
  readonly promptingEnabled?: boolean;
}
