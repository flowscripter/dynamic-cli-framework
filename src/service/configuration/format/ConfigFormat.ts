/**
 * The top level structure of a configuration file: `defaults` and `key-values` objects.
 */
export type ConfigData = Record<string, any>;

/**
 * Defines the on-disk syntax of the CLI configuration file.
 *
 * The built-in implementation is JSON (the default). YAML and TOML implementations are available
 * from the `@flowscripter/dynamic-cli-framework/yaml` and `@flowscripter/dynamic-cli-framework/toml`
 * entry points. Third party formats can be supplied by implementing this interface.
 */
export default interface ConfigFormat {
  /**
   * The extension (without the leading dot) used for the default configuration file name,
   * e.g. `json`.
   */
  readonly fileExtension: string;

  /**
   * Parse configuration file text.
   *
   * @returns the parsed `data` and an opaque `handle` retaining whatever the format needs to write
   * changes back while preserving comments and layout (`undefined` if the format has nothing to retain).
   * @throws if the text is not valid for this format.
   */
  parse(text: string): { data: ConfigData; handle: unknown };

  /**
   * Produce updated file text from a `handle` returned by {@link parse}.
   *
   * @param handle the handle returned by {@link parse} for the text being updated.
   * @param changes the complete updated configuration data. The format reconciles the existing text
   * with it, leaving unchanged content (including comments) untouched.
   */
  apply(handle: unknown, changes: ConfigData): string;

  /**
   * Produce new file text from scratch.
   */
  serialize(data: ConfigData): string;
}
