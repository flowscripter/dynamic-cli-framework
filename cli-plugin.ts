export type { default as CommandFactory } from "./src/api/plugin/CommandFactory.ts";
export { DYNAMIC_CLI_FRAMEWORK_COMMAND_FACTORY_EXTENSION_POINT } from "./src/api/plugin/CommandFactory.ts";
export type { default as ServiceProviderFactory } from "./src/api/plugin/ServiceProviderFactory.ts";
export { DYNAMIC_CLI_FRAMEWORK_SERVICE_PROVIDER_FACTORY_EXTENSION_POINT } from "./src/api/plugin/ServiceProviderFactory.ts";
export type { default as Command } from "./src/api/command/Command.ts";
export type { default as SubCommand } from "./src/api/command/SubCommand.ts";
export type { default as GlobalCommand } from "./src/api/command/GlobalCommand.ts";
export type { default as GroupCommand } from "./src/api/command/GroupCommand.ts";
export type { ServiceProvider, ServiceInfo } from "./src/api/service/ServiceProvider.ts";
export type { default as Context } from "./src/api/Context.ts";
export type { default as CLIConfig } from "./src/api/CLIConfig.ts";
export type { ArgumentValues } from "./src/api/argument/ArgumentValueTypes.ts";
export { ArgumentValueTypeName } from "./src/api/argument/ArgumentValueTypes.ts";
export type { default as Option } from "./src/api/argument/Option.ts";
export type { default as Positional } from "./src/api/argument/Positional.ts";
export type {
  Plugin,
  ExtensionDescriptor,
  ExtensionFactory,
} from "@flowscripter/dynamic-plugin-framework";
export type {
  default as CLIPlugin,
  CommandFactoryExtensionDescriptor,
  ServiceProviderFactoryExtensionDescriptor,
} from "./src/api/plugin/CLIPlugin.ts";
export { default as createCLIPlugin } from "./src/api/plugin/createCLIPlugin.ts";
export type { CLIPluginOptions } from "./src/api/plugin/createCLIPlugin.ts";

// Core Service IDs and types
export { ASCII_BANNER_GENERATOR_SERVICE_ID } from "./src/api/service/core/AsciiBannerGeneratorService.ts";
export type { default as AsciiBannerGeneratorService } from "./src/api/service/core/AsciiBannerGeneratorService.ts";
export type {
  BannerColorEffects,
  BannerGenerateOptions,
  ColorEffect,
  ColorEffectDirection,
  FixedColorEffect,
  GradientColorEffect,
  RainbowColorEffect,
} from "./src/api/service/core/AsciiBannerGeneratorService.ts";

export { KEY_VALUE_SERVICE_ID } from "./src/api/service/core/KeyValueService.ts";
export { SECRET_SENTINEL_PREFIX } from "./src/api/service/core/KeyValueService.ts";
export type { default as KeyValueService } from "./src/api/service/core/KeyValueService.ts";
export type { default as SecretService } from "./src/api/service/core/SecretService.ts";

export { PRINTER_SERVICE_ID } from "./src/api/service/core/PrinterService.ts";
export type { default as PrinterService } from "./src/api/service/core/PrinterService.ts";
export { Icon, Level, ProgressStyle, SpinnerStyle } from "./src/api/service/core/PrinterService.ts";

export { SHUTDOWN_SERVICE_ID } from "./src/api/service/core/ShutdownService.ts";
export type { default as ShutdownService } from "./src/api/service/core/ShutdownService.ts";

export { SYNTAX_HIGHLIGHTER_SERVICE_ID } from "./src/api/service/core/SyntaxHighlighterService.ts";
export type { default as SyntaxHighlighterService } from "./src/api/service/core/SyntaxHighlighterService.ts";
export type { ColorScheme } from "./src/api/service/core/SyntaxHighlighterService.ts";

export { PRETTY_PRINTER_SERVICE_ID } from "./src/api/service/core/PrettyPrinterService.ts";
export type { default as PrettyPrinterService } from "./src/api/service/core/PrettyPrinterService.ts";

export { IMAGE_PRINTER_SERVICE_ID } from "./src/api/service/core/ImagePrinterService.ts";
export type { default as ImagePrinterService } from "./src/api/service/core/ImagePrinterService.ts";

export { TREE_PRINTER_SERVICE_ID } from "./src/api/service/core/TreePrinterService.ts";
export type { default as TreePrinterService } from "./src/api/service/core/TreePrinterService.ts";
export type { TreeNode } from "./src/api/service/core/TreePrinterService.ts";

export { TABLE_GENERATOR_SERVICE_ID } from "./src/api/service/core/TableGeneratorService.ts";
export type { default as TableGeneratorService } from "./src/api/service/core/TableGeneratorService.ts";
export {
  Align,
  type CellOptions,
  type ColumnOptions,
  type RowOptions,
  type TableOptions,
} from "./src/api/service/core/TableGeneratorService.ts";
export type { default as Table } from "./src/api/service/core/Table.ts";

export { DATA_DUMP_GENERATOR_SERVICE_ID } from "./src/api/service/core/DataDumpGeneratorService.ts";
export type { default as DataDumpGeneratorService } from "./src/api/service/core/DataDumpGeneratorService.ts";
export {
  type ByteRangeColor,
  DumpFormat,
  type HexDumpGenerateOptions,
} from "./src/api/service/core/DataDumpGeneratorService.ts";

export { COMPLETION_SERVICE_ID } from "./src/api/service/core/CompletionService.ts";
export type { default as CompletionService } from "./src/api/service/core/CompletionService.ts";
export { type CompletionItem, ShellType } from "./src/api/service/core/CompletionService.ts";

export { PROMPTER_SERVICE_ID } from "./src/api/service/core/PrompterService.ts";
export type { default as PrompterService } from "./src/api/service/core/PrompterService.ts";
export {
  type Prompt,
  type PromptOption,
  type PromptResult,
  PromptType,
} from "./src/api/service/core/PrompterService.ts";

export { ARGUMENT_PROMPTER_SERVICE_ID } from "./src/api/service/core/ArgumentPrompterService.ts";
export type { default as ArgumentPrompterService } from "./src/api/service/core/ArgumentPrompterService.ts";

export { PLUGIN_SERVICE_ID } from "./src/api/service/core/PluginService.ts";
export type { default as PluginService } from "./src/api/service/core/PluginService.ts";
