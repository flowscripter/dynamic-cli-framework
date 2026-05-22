export default interface BaseCLIFeatureOptions {
  readonly configFileSupportEnabled?: boolean;
  readonly envVarsSupportEnabled?: boolean;
  readonly keyValueServiceEnabled?: boolean;
  readonly secretServiceEnabled?: boolean;
  readonly argumentPrompterServiceEnabled?: boolean;
  readonly completionServiceEnabled?: boolean;
  readonly validateAllCommands?: boolean;
}
