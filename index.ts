// Argument API
export type { Argument } from "@flowscripter/dynamic-cli-framework-api";
export type {
  ArgumentSingleValueType,
  ArgumentValues,
  ArgumentValueType,
  PopulatedArgumentSingleValueType,
  PopulatedArgumentValues,
  PopulatedArgumentValueType,
} from "@flowscripter/dynamic-cli-framework-api";
export {
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "@flowscripter/dynamic-cli-framework-api";
export type { ComplexOption } from "@flowscripter/dynamic-cli-framework-api";
export { MAXIMUM_COMPLEX_OPTION_NESTING_DEPTH } from "@flowscripter/dynamic-cli-framework-api";
export type { SubCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
export { MAXIMUM_ARGUMENT_ARRAY_SIZE } from "@flowscripter/dynamic-cli-framework-api";
export type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
export type { Option } from "@flowscripter/dynamic-cli-framework-api";
export type { Positional } from "@flowscripter/dynamic-cli-framework-api";

// Command API
export type { Command } from "@flowscripter/dynamic-cli-framework-api";
export type { GlobalCommand } from "@flowscripter/dynamic-cli-framework-api";
export type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
export type { GroupCommand } from "@flowscripter/dynamic-cli-framework-api";
export type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
export type { UsageExample } from "@flowscripter/dynamic-cli-framework-api";

// Service API
export type { ServiceInfo, ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";

// Registry API
export type { CommandRegistry } from "@flowscripter/dynamic-cli-framework-api";
export type { ServiceProviderRegistry } from "@flowscripter/dynamic-cli-framework-api";

// Core Services
export { ASCII_BANNER_GENERATOR_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { AsciiBannerGeneratorService } from "@flowscripter/dynamic-cli-framework-api";
export type {
  BannerColorEffects,
  BannerGenerateOptions,
  ColorEffect,
  ColorEffectDirection,
  FixedColorEffect,
  GradientColorEffect,
  RainbowColorEffect,
} from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultAsciiBannerGeneratorService } from "./src/service/asciiBannerGenerator/DefaultAsciiBannerGeneratorService.ts";
export { default as AsciiBannerGeneratorServiceProvider } from "./src/service/asciiBannerGenerator/AsciiBannerGeneratorServiceProvider.ts";
export { default as ChiselFontAsciiBannerGeneratorService } from "./src/service/chiselAsciiBannerGenerator/ChiselFontAsciiBannerGeneratorService.ts";
export type {
  ChiselBannerColors,
  ChiselBannerGenerateOptions,
} from "./src/service/chiselAsciiBannerGenerator/ChiselFontAsciiBannerGeneratorService.ts";

export { default as BannerServiceProvider } from "./src/service/banner/BannerServiceProvider.ts";

export { KEY_VALUE_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export { SECRET_SENTINEL_PREFIX } from "@flowscripter/dynamic-cli-framework-api";
export type { KeyValueService } from "@flowscripter/dynamic-cli-framework-api";
export type { SecretService } from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultKeyValueService } from "./src/service/configuration/DefaultKeyValueService.ts";
export { default as DefaultSecretService } from "./src/service/configuration/DefaultSecretService.ts";
export type { SecretsApi } from "./src/service/configuration/DefaultSecretService.ts";
export { default as ConfigCommand } from "./src/service/configuration/command/ConfigCommand.ts";
export { default as ConfigurationServiceProvider } from "./src/service/configuration/ConfigurationServiceProvider.ts";

export { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
export { Icon, Level, ProgressStyle, SpinnerStyle } from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultPrinterService } from "./src/service/printer/DefaultPrinterService.ts";
export { default as PrinterServiceProvider } from "./src/service/printer/PrinterServiceProvider.ts";

export { SHUTDOWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { ShutdownService } from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultShutdownService } from "./src/service/shutdown/DefaultShutdownService.ts";
export { default as ShutdownServiceProvider } from "./src/service/shutdown/ShutdownServiceProvider.ts";

export { FETCH_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { FetchOptions, FetchService } from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultFetchService } from "./src/service/fetch/DefaultFetchService.ts";
export { default as FetchServiceProvider } from "./src/service/fetch/FetchServiceProvider.ts";

export { SPAWN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type {
  SpawnOptions,
  SpawnResult,
  SpawnService,
} from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultSpawnService } from "./src/service/spawn/DefaultSpawnService.ts";
export { default as SpawnServiceProvider } from "./src/service/spawn/SpawnServiceProvider.ts";

export { SYNTAX_HIGHLIGHTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { SyntaxHighlighterService } from "@flowscripter/dynamic-cli-framework-api";
export type { ColorScheme } from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultSyntaxHighlighterService } from "./src/service/syntaxHighlighter/DefaultSyntaxHighlighterService.ts";
export { default as SyntaxHighlighterServiceProvider } from "./src/service/syntaxHighlighter/SyntaxHighlighterServiceProvider.ts";

export { PRETTY_PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { PrettyPrinterService } from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultPrettyPrinterService } from "./src/service/prettyPrinter/DefaultPrettyPrinterService.ts";
export { default as PrettyPrinterServiceProvider } from "./src/service/prettyPrinter/PrettyPrinterServiceProvider.ts";

export { IMAGE_PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { ImagePrinterService } from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultImagePrinterService } from "./src/service/imagePrinter/DefaultImagePrinterService.ts";
export { default as ImagePrinterServiceProvider } from "./src/service/imagePrinter/ImagePrinterServiceProvider.ts";

export { TREE_PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { TreePrinterService } from "@flowscripter/dynamic-cli-framework-api";
export type { TreeNode } from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultTreePrinterService } from "./src/service/treePrinter/DefaultTreePrinterService.ts";
export { default as TreePrinterServiceProvider } from "./src/service/treePrinter/TreePrinterServiceProvider.ts";

export { TABLE_GENERATOR_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { TableGeneratorService } from "@flowscripter/dynamic-cli-framework-api";
export {
  Align,
  type CellOptions,
  type ColumnOptions,
  type RowOptions,
  type TableOptions,
} from "@flowscripter/dynamic-cli-framework-api";
export { Table } from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultTableGeneratorService } from "./src/service/tableGenerator/DefaultTableGeneratorService.ts";
export { default as TableGeneratorServiceProvider } from "./src/service/tableGenerator/TableGeneratorServiceProvider.ts";

export { DATA_DUMP_GENERATOR_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { DataDumpGeneratorService } from "@flowscripter/dynamic-cli-framework-api";
export {
  type ByteRangeColor,
  DumpFormat,
  type HexDumpGenerateOptions,
} from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultDataDumpGeneratorService } from "./src/service/dataDumpGenerator/DefaultDataDumpGeneratorService.ts";
export { default as DataDumpGeneratorServiceProvider } from "./src/service/dataDumpGenerator/DataDumpGeneratorServiceProvider.ts";

export { COMPLETION_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { CompletionService } from "@flowscripter/dynamic-cli-framework-api";
export { type CompletionItem, ShellType } from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultCompletionService } from "./src/service/completion/DefaultCompletionService.ts";
export { default as CompletionServiceProvider } from "./src/service/completion/CompletionServiceProvider.ts";

export { PROMPTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { PrompterService } from "@flowscripter/dynamic-cli-framework-api";
export {
  type Prompt,
  type PromptOption,
  type PromptResult,
  PromptType,
} from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultPrompterService } from "./src/service/prompter/DefaultPrompterService.ts";
export {
  DEFAULT_PROMPTER_CONFIG,
  type PrompterServiceConfig,
} from "./src/service/prompter/DefaultPrompterService.ts";
export { default as PrompterServiceProvider } from "./src/service/prompter/PrompterServiceProvider.ts";

export { ARGUMENT_PROMPTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { ArgumentPrompterService } from "@flowscripter/dynamic-cli-framework-api";
export type { ParseResult } from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultArgumentPrompterService } from "./src/service/argumentPrompter/DefaultArgumentPrompterService.ts";
export { default as ArgumentPrompterServiceProvider } from "./src/service/argumentPrompter/ArgumentPrompterServiceProvider.ts";

// CLI API
export type { InvalidArgument } from "@flowscripter/dynamic-cli-framework-api";
export type { Context } from "@flowscripter/dynamic-cli-framework-api";
export type { RunResult } from "@flowscripter/dynamic-cli-framework-api";
export { InvalidArgumentReason, RunState } from "@flowscripter/dynamic-cli-framework-api";
export type { default as BaseCLIFeatureOptions } from "./src/cli/BaseCLIFeatureOptions.ts";
export type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
export type { CLI } from "@flowscripter/dynamic-cli-framework-api";

// Help Commands
export {
  SingleCommandCliHelpGlobalCommand,
  SingleCommandCliHelpSubCommand,
} from "./src/command/SingleCommandCliHelpCommand.ts";
export {
  MultiCommandCliHelpGlobalCommand,
  MultiCommandCliHelpSubCommand,
} from "./src/command/MultiCommandCliHelpCommand.ts";

// Plugin API
export type { CommandFactory } from "@flowscripter/dynamic-cli-framework-api";
export { DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT } from "@flowscripter/dynamic-cli-framework-api";
export type { ServiceProviderFactory } from "@flowscripter/dynamic-cli-framework-api";
export { DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT } from "@flowscripter/dynamic-cli-framework-api";
export { PLUGIN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
export type { PluginService } from "@flowscripter/dynamic-cli-framework-api";
export { default as DefaultPluginServiceProvider } from "./src/service/plugin/DefaultPluginServiceProvider.ts";

// Core CLI
export { default as BaseCLI } from "./src/cli/BaseCLI.ts";
export { default as DefaultRuntimeCLI } from "./src/cli/DefaultRuntimeCLI.ts";
export { default as DynamicPluginRuntimeCLI } from "./src/cli/DynamicPluginRuntimeCLI.ts";

// Terminal API
export type { default as Terminal } from "./src/terminal/Terminal.ts";
export type { default as Styler } from "./src/terminal/Styler.ts";
export type { default as KeyReader, KeyEvent } from "./src/terminal/KeyReader.ts";
export { SpecialKey } from "./src/terminal/KeyReader.ts";
export { default as TtyKeyReader } from "./src/terminal/TtyKeyReader.ts";

// Convenience functions
export {
  launchDynamicPluginMultiCommandCLI,
  launchMultiCommandCLI,
  launchSingleCommandCLI,
} from "./src/launcher.ts";
