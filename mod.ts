// Argument API
export type { default as Argument } from "./src/api/argument/Argument.ts";
export type {
  ArgumentSingleValueType,
  ArgumentValues,
  ArgumentValueType,
  PopulatedArgumentSingleValueType,
  PopulatedArgumentValues,
  PopulatedArgumentValueType,
} from "./src/api/argument/ArgumentValueTypes.ts";
export {
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "./src/api/argument/ArgumentValueTypes.ts";
export type { default as ComplexOption } from "./src/api/argument/ComplexOption.ts";
export type { default as SubCommandArgument } from "./src/api/argument/SubCommandArgument.ts";
export type { default as GlobalCommandArgument } from "./src/api/argument/GlobalCommandArgument.ts";
export type { default as Option } from "./src/api/argument/Option.ts";
export type { default as Positional } from "./src/api/argument/Positional.ts";

// Command API
export type { default as Command } from "./src/api/command/Command.ts";
export type { default as GlobalCommand } from "./src/api/command/GlobalCommand.ts";
export type { default as GlobalModifierCommand } from "./src/api/command/GlobalModifierCommand.ts";
export type { default as GroupCommand } from "./src/api/command/GroupCommand.ts";
export type { default as SubCommand } from "./src/api/command/SubCommand.ts";
export type { default as UsageExample } from "./src/api/command/UsageExample.ts";

// Service API
export type {
  ServiceInfo,
  ServiceProvider,
} from "./src/api/service/ServiceProvider.ts";

// Registry API
export type { default as CommandRegistry } from "./src/runtime/registry/CommandRegistry.ts";
export type { default as ServiceProviderRegistry } from "./src/runtime/registry/ServiceProviderRegistry.ts";

// Core Services
export { ASCII_BANNER_GENERATOR_SERVICE_ID } from "./src/api/service/core/AsciiBannerGeneratorService.ts";
export type { default as AsciiBannerGeneratorService } from "./src/api/service/core/AsciiBannerGeneratorService.ts";
export { default as DefaultAsciiBannerGeneratorService } from "./src/service/asciiBannerGenerator/DefaultAsciiBannerGeneratorService.ts";
export { default as AsciiBannerGeneratorServiceProvider } from "./src/service/asciiBannerGenerator/AsciiBannerGeneratorServiceProvider.ts";

export { default as BannerServiceProvider } from "./src/service/banner/BannerServiceProvider.ts";

export { KEY_VALUE_SERVICE_ID } from "./src/api/service/core/KeyValueService.ts";
export type { default as KeyValueService } from "./src/api/service/core/KeyValueService.ts";
export { default as DefaultKeyValueService } from "./src/service/configuration/DefaultKeyValueService.ts";
export { default as ConfigurationServiceProvider } from "./src/service/configuration/ConfigurationServiceProvider.ts";

export { PRINTER_SERVICE_ID } from "./src/api/service/core/PrinterService.ts";
export type {
  default as PrinterService,
} from "./src/api/service/core/PrinterService.ts";
export { Icon, Level } from "./src/api/service/core/PrinterService.ts";
export { default as DefaultPrinterService } from "./src/service/printer/DefaultPrinterService.ts";
export { default as PrinterServiceProvider } from "./src/service/printer/PrinterServiceProvider.ts";

export { SHUTDOWN_SERVICE_ID } from "./src/api/service/core/ShutdownService.ts";
export type { default as ShutdownService } from "./src/api/service/core/ShutdownService.ts";
export { default as DefaultShutdownService } from "./src/service/shutdown/DefaultShutdownService.ts";
export { default as ShutdownServiceProvider } from "./src/service/shutdown/ShutdownServiceProvider.ts";

export { SYNTAX_HIGHLIGHTER_SERVICE_ID } from "./src/api/service/core/SyntaxHighlighterService.ts";
export type { default as SyntaxHighlighterService } from "./src/api/service/core/SyntaxHighlighterService.ts";
export { default as DefaultSyntaxHighlighterService } from "./src/service/syntaxHighlighter/DefaultSyntaxHighlighterService.ts";
export { default as SyntaxHighlighterServiceProvider } from "./src/service/syntaxHighlighter/SyntaxHighlighterServiceProvider.ts";

// CLI API
export type { InvalidArgument } from "./src/api/RunResult.ts";
export type { default as Context } from "./src/api/Context.ts";
export type {
  default as RunResult,
  InvalidArgumentReason,
  RunState,
} from "./src/api/RunResult.ts";
export type { default as CLIConfig } from "./src/api/CLIConfig.ts";
export type { default as CLI } from "./src/api/CLI.ts";

// Core CLI
export { default as BaseCLI } from "./src/cli/BaseCLI.ts";
export { default as DenoRuntimeCLI } from "./src/cli/DenoRuntimeCLI.ts";

// Convenience functions
export {
  launchMultiCommandCLI,
  launchSingleCommandCLI,
} from "./src/launcher.ts";
