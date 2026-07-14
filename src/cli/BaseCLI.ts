import type { CLI } from "@flowscripter/dynamic-cli-framework-api";
import type { RunResult } from "@flowscripter/dynamic-cli-framework-api";
import { RunState } from "@flowscripter/dynamic-cli-framework-api";
import getLogger from "../util/logger.ts";
import DefaultCommandRegistry from "../runtime/registry/DefaultCommandRegistry.ts";
import type { Command } from "@flowscripter/dynamic-cli-framework-api";
import DefaultServiceProviderRegistry from "../runtime/registry/DefaultServiceProviderRegistry.ts";
import DefaultContext from "../runtime/DefaultContext.ts";
import type { ServiceProvider } from "@flowscripter/dynamic-cli-framework-api";
import type { CLIConfig } from "@flowscripter/dynamic-cli-framework-api";
import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommand } from "@flowscripter/dynamic-cli-framework-api";
import {
  SingleCommandCliHelpGlobalCommand,
  SingleCommandCliHelpSubCommand,
} from "../command/SingleCommandCliHelpCommand.ts";
import {
  MultiCommandCliHelpGlobalCommand,
  MultiCommandCliHelpSubCommand,
} from "../command/MultiCommandCliHelpCommand.ts";
import VersionCommand from "../command/VersionCommand.ts";
import UsageCommand from "../command/UsageCommand.ts";
import {
  isGlobalCommand,
  isGlobalModifierCommand,
  isGroupCommand,
  isSubCommand,
} from "../runtime/command/CommandTypeGuards.ts";
import CommandValidator from "../runtime/command/CommandValidator.ts";
import ShutdownServiceProvider from "../service/shutdown/ShutdownServiceProvider.ts";
import { shutdownState } from "../service/shutdown/ShutdownState.ts";
import ConfigurationServiceProvider from "../service/configuration/ConfigurationServiceProvider.ts";
import PrinterServiceProvider from "../service/printer/PrinterServiceProvider.ts";
import TableGeneratorServiceProvider from "../service/tableGenerator/TableGeneratorServiceProvider.ts";
import { run } from "../runtime/runner.ts";
import { printRuntimeError } from "../util/runnerHelper.ts";

import { WritableStream } from "node:stream/web";
import type Terminal from "../terminal/Terminal.ts";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import DefaultPrinterService from "../service/printer/DefaultPrinterService.ts";
import type Styler from "../terminal/Styler.ts";
import type KeyReader from "../terminal/KeyReader.ts";
import type BaseCLIFeatureOptions from "./BaseCLIFeatureOptions.ts";
import DefaultPrompterService, {
  DEFAULT_PROMPTER_CONFIG,
} from "../service/prompter/DefaultPrompterService.ts";
import PrompterServiceProvider from "../service/prompter/PrompterServiceProvider.ts";
import DefaultArgumentPrompterService from "../service/argumentPrompter/DefaultArgumentPrompterService.ts";
import ArgumentPrompterServiceProvider from "../service/argumentPrompter/ArgumentPrompterServiceProvider.ts";
import DefaultCompletionService from "../service/completion/DefaultCompletionService.ts";
import CompletionServiceProvider from "../service/completion/CompletionServiceProvider.ts";
import ImagePrinterServiceProvider from "../service/imagePrinter/ImagePrinterServiceProvider.ts";
import SpawnServiceProvider from "../service/spawn/SpawnServiceProvider.ts";
const logger = getLogger("BaseCLI");

/**
 * Base implementation of a {@link CLI}.
 *
 * By default the following service providers are added:
 *
 * * {@link ShutdownServiceProvider}
 * * {@link PrinterServiceProvider}
 * * {@link ConfigurationServiceProvider}
 * * {@link TableGeneratorServiceProvider}
 *
 * NOTE: The `ConfigurationServiceProvider` will not be added if the required `allow-read` and `allow-write`
 * permissions are not granted. It can also be excluded if desired via a constructor argument.
 *
 * Optionally enabled via {@link BaseCLIFeatureOptions}:
 *
 * * {@link ImagePrinterServiceProvider}
 * * {@link SpawnServiceProvider}
 *
 * `keyReader` is optional. If omitted, or if the stderr {@link Terminal} is not a TTY, prompting is
 * unavailable: {@link PrompterServiceProvider} (and {@link ArgumentPrompterServiceProvider}, if
 * enabled) are simply not registered. If `promptingEnabled` is `true` in that situation, {@link run}
 * throws rather than failing later inside a prompt. Similarly {@link ImagePrinterServiceProvider} is
 * only registered if the stdout {@link Terminal} is a TTY.
 *
 * By default the following commands are added:
 *
 * * {@link SingleCommandCliHelpSubCommand} or {@link MultiCommandCliHelpSubCommand}
 * * {@link SingleCommandCliHelpGlobalCommand} or {@link MultiCommandCliHelpGlobalCommand}
 * * commands provided by the {@link ConfigurationServiceProvider}.
 * * commands provided by the {@link PrinterServiceProvider}.
 */
export default class BaseCLI implements CLI {
  readonly #cliConfig: CLIConfig;
  readonly #options: Required<BaseCLIFeatureOptions>;
  readonly #keyReader: KeyReader | undefined;
  readonly #stderrTerminal: Terminal;
  readonly #addedNonModifierCommands: Array<Command>;
  readonly #serviceProviderRegistry: DefaultServiceProviderRegistry;
  readonly #commandRegistry: DefaultCommandRegistry;
  readonly #context: DefaultContext;
  readonly #printerService: PrinterService;
  readonly #stdoutTerminal: Terminal;

  constructor(
    cliConfig: CLIConfig,
    stdoutWritableStream: WritableStream,
    stderrWritableStream: WritableStream,
    stdoutIsColor: boolean,
    stderrIsColor: boolean,
    stdoutTerminal: Terminal,
    stderrTerminal: Terminal,
    styler: Styler,
    keyReader: KeyReader | undefined,
    options?: BaseCLIFeatureOptions,
  ) {
    if (cliConfig.name.length === 0) {
      throw new Error("Invalid empty CLI name provided");
    }
    if (cliConfig.name[0]!.match(/[0-9\-_]/)) {
      throw new Error(
        `Invalid CLI name starting with a digit or dash provided: '${cliConfig.name}'`,
      );
    }
    if (cliConfig.description !== undefined && cliConfig.description.length === 0) {
      throw new Error("Invalid empty CLI description provided");
    }
    if (cliConfig.version !== undefined && cliConfig.version.length === 0) {
      throw new Error("Invalid empty CLI version provided");
    }
    this.#cliConfig = cliConfig;
    this.#options = {
      configFileSupportEnabled: false,
      envVarsSupportEnabled: false,
      keyValueServiceEnabled: false,
      secretServiceEnabled: false,
      argumentPrompterServiceEnabled: false,
      completionServiceEnabled: false,
      imagePrinterServiceEnabled: false,
      spawnServiceEnabled: false,
      validateAllCommands: false,
      promptingEnabled: true,
      ...options,
    };
    this.#keyReader = keyReader;
    this.#stderrTerminal = stderrTerminal;
    this.#addedNonModifierCommands = [];

    let commandValidator: CommandValidator | undefined;
    if (this.#options.validateAllCommands) {
      commandValidator = new CommandValidator(this.#cliConfig);
    }

    // create a service provider registry
    this.#serviceProviderRegistry = new DefaultServiceProviderRegistry();

    // create a command registry
    this.#commandRegistry = new DefaultCommandRegistry([], commandValidator);

    // create a context
    this.#context = new DefaultContext(this.#cliConfig);

    this.#stdoutTerminal = stdoutTerminal;
    this.#printerService = new DefaultPrinterService(
      stdoutWritableStream,
      stderrWritableStream,
      stdoutIsColor,
      stderrIsColor,
      stdoutTerminal,
      stderrTerminal,
      styler,
    );
  }

  /**
   * Add a {@link ServiceProvider} to the CLI's {@link ServiceProviderRegistry}.
   *
   * This will register the {@link ServiceProvider}, add any provided services to the {@link Context} and register
   * any provided {@link Command} instances.
   *
   * @param serviceProvider the {@link ServiceProvider} to add.
   */
  public addServiceProvider(serviceProvider: ServiceProvider) {
    this.#serviceProviderRegistry.addServiceProvider(serviceProvider);
  }

  /**
   * Add a {@link Command} to the CLI's {@link CommandRegistry}.
   *
   * If only one non-modifier {@link Command} is added, the CLI will operate as a single command CLI and the provided
   * command will be set as a default command. If more than one command is added, the CLI will operate as a
   * multi-command CLI. In this case the default command will be set to a help command.
   *
   * @param command the {@link Command} to add.
   */
  public addCommand(command: Command) {
    if (!isGlobalModifierCommand(command)) {
      // store the command locally to help determine if this CLI will be a single or multi-command CLI
      this.#addedNonModifierCommands.push(command);
    }

    // register the command
    this.#commandRegistry.addCommand(command);
  }

  async run(args: ReadonlyArray<string>): Promise<RunResult> {
    if (this.#addedNonModifierCommands.length === 0) {
      throw new Error("No non-modifier commands added to the CLI, nothing to run!");
    }

    if (
      this.#addedNonModifierCommands.length === 1 &&
      !isSubCommand(this.#addedNonModifierCommands[0]!) &&
      !isGlobalCommand(this.#addedNonModifierCommands[0]!) &&
      !isGroupCommand(this.#addedNonModifierCommands[0]!)
    ) {
      throw new Error(
        "If only one command is added, it must be a global command, sub-command, or group command!",
      );
    }

    // create and add core services
    this.addServiceProvider(new ShutdownServiceProvider(100));
    this.addServiceProvider(new PrinterServiceProvider(80, this.#printerService));
    this.addServiceProvider(new TableGeneratorServiceProvider(70));

    const canPrompt = this.#keyReader !== undefined && this.#stderrTerminal.isTty();

    if (this.#options.promptingEnabled && !canPrompt) {
      throw new Error("promptingEnabled requires a keyReader and a TTY stderr terminal");
    }

    let prompterService: DefaultPrompterService | undefined;
    if (canPrompt) {
      prompterService = new DefaultPrompterService(
        DEFAULT_PROMPTER_CONFIG,
        this.#stderrTerminal,
        this.#keyReader!,
        this.#printerService,
      );
      prompterService.promptEnabled = this.#options.promptingEnabled;
      this.addServiceProvider(new PrompterServiceProvider(75, prompterService));
    } else {
      logger.debug(
        () =>
          `Skipping PrompterServiceProvider: keyReader present: ${
            this.#keyReader !== undefined
          }, stderr isTty: ${this.#stderrTerminal.isTty()}`,
      );
    }

    if (this.#options.argumentPrompterServiceEnabled) {
      if (prompterService !== undefined) {
        const argumentPrompterService = new DefaultArgumentPrompterService(prompterService);
        this.addServiceProvider(new ArgumentPrompterServiceProvider(65, argumentPrompterService));
      } else {
        logger.debug(
          "Skipping ArgumentPrompterServiceProvider: argumentPrompterServiceEnabled is true but prompting is unavailable",
        );
      }
    }

    if (this.#options.imagePrinterServiceEnabled) {
      if (this.#stdoutTerminal.isTty()) {
        this.addServiceProvider(new ImagePrinterServiceProvider(55, this.#stdoutTerminal));
      } else {
        logger.debug(
          "Skipping ImagePrinterServiceProvider: imagePrinterServiceEnabled is true but stdout is not a TTY",
        );
      }
    }

    if (this.#options.spawnServiceEnabled) {
      this.addServiceProvider(new SpawnServiceProvider(58));
    }

    if (this.#options.completionServiceEnabled) {
      const completionService = new DefaultCompletionService();
      this.addServiceProvider(
        new CompletionServiceProvider(5, completionService, this.#commandRegistry),
      );
    }

    const configurationServiceProvider = new ConfigurationServiceProvider(
      90,
      this.#options.envVarsSupportEnabled,
      this.#options.configFileSupportEnabled,
      this.#options.keyValueServiceEnabled,
      this.#options.secretServiceEnabled,
    );
    this.addServiceProvider(configurationServiceProvider);

    for (const serviceProvider of this.#serviceProviderRegistry.getServiceProviders()) {
      const serviceInfo = await serviceProvider.getServiceInfo(this.#cliConfig);

      if (serviceInfo.service) {
        this.#context.addServiceInstance(serviceProvider.serviceId, serviceInfo.service);
      }

      serviceInfo.commands.forEach((command) => {
        this.#commandRegistry.addCommand(command, serviceProvider.serviceId);
      });
    }

    logger.debug(() => `Running with args: ${args.join(" ")}`);

    let helpSubCommand: SubCommand | undefined;
    let helpGlobalCommand: GlobalCommand | undefined;
    let defaultCommand: Command | undefined;

    try {
      // setup help commands and default command based on the number of commands explicitly added via {@link addCommand)
      if (
        this.#addedNonModifierCommands.length === 1 &&
        !isGroupCommand(this.#addedNonModifierCommands[0]!)
      ) {
        // a single-command CLI
        defaultCommand = this.#addedNonModifierCommands[0];
        helpSubCommand = new SingleCommandCliHelpSubCommand(
          this.#options.envVarsSupportEnabled,
          defaultCommand as SubCommand,
          this.#commandRegistry,
        );
        helpGlobalCommand = new SingleCommandCliHelpGlobalCommand(
          this.#options.envVarsSupportEnabled,
          defaultCommand as SubCommand,
          this.#commandRegistry,
        );
      } else {
        // a multi-command CLI
        helpSubCommand = new MultiCommandCliHelpSubCommand(
          this.#options.envVarsSupportEnabled,
          this.#commandRegistry,
        );
        helpGlobalCommand = new MultiCommandCliHelpGlobalCommand(
          this.#options.envVarsSupportEnabled,
          this.#commandRegistry,
        );
      }

      // register the help commands
      this.#commandRegistry.addCommand(helpSubCommand);
      this.#commandRegistry.addCommand(helpGlobalCommand);

      // register the version command
      this.#commandRegistry.addCommand(new VersionCommand());

      // run...
      const runResult = await run(
        args,
        this.#commandRegistry,
        this.#serviceProviderRegistry,
        configurationServiceProvider,
        this.#context,
        defaultCommand,
      );
      // then handle the result...
      if (runResult.runState === RunState.NO_COMMAND) {
        // print usage
        await new UsageCommand(helpGlobalCommand).execute(this.#context);
      } else if (runResult.runState === RunState.PARSE_ERROR) {
        if (
          runResult.command !== undefined &&
          (isSubCommand(runResult.command) || isGlobalCommand(runResult.command))
        ) {
          // print help on specific command
          await helpSubCommand.execute(this.#context, {
            command: runResult.command!.name,
          });
        } else {
          // print usage
          await new UsageCommand(helpGlobalCommand).execute(this.#context);
        }
      }
      return runResult;
    } catch (error) {
      if (shutdownState.shutdownRequested || (error as Error).message === "Interrupted") {
        return { runState: RunState.INTERRUPTED };
      }
      await printRuntimeError(this.#context, error as Error);
      return {
        runState: RunState.RUNTIME_ERROR,
        error: error as Error,
      };
    } finally {
      await ShutdownServiceProvider.shutdown();
    }
  }
}
