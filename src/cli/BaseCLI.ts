import CLI from "../api/CLI.ts";
import RunResult, { RunState } from "../api/RunResult.ts";
import getLogger from "../util/logger.ts";
import DefaultCommandRegistry from "../runtime/registry/DefaultCommandRegistry.ts";
import Command from "../api/command/Command.ts";
import DefaultServiceProviderRegistry from "../runtime/registry/DefaultServiceProviderRegistry.ts";
import DefaultContext from "../runtime/DefaultContext.ts";
import ServiceProvider from "../api/service/ServiceProvider.ts";
import CLIConfig from "../api/CLIConfig.ts";
import SubCommand from "../api/command/SubCommand.ts";
import GlobalCommand from "../api/command/GlobalCommand.ts";
import {
  SingleCommandCliHelpGlobalCommand,
  SingleCommandCliHelpSubCommand,
} from "../command/SingleCommandCliHelpCommand.ts";
import {
  MultiCommandCliHelpGlobalCommand,
  MultiCommandCliHelpSubCommand,
} from "../command/MultiCommandCliHelpCommand.ts";
import {
  isGlobalCommand,
  isGlobalModifierCommand,
  isSubCommand,
} from "../api/command/CommandTypeGuards.ts";
import CommandValidator from "../runtime/command/CommandValidator.ts";
import ShutdownServiceProvider from "../service/shutdown/ShutdownServiceProvider.ts";
import ConfigurationServiceProvider from "../service/configuration/ConfigurationServiceProvider.ts";
import PrinterServiceProvider from "../service/printer/PrinterServiceProvider.ts";
import { run } from "../runtime/runner.ts";

const logger = getLogger("BaseCLI");

/**
 * Base implementation of a {@link CLI}.
 *
 * By default the following service providers are added:
 *
 * * {@link ShutdownServiceProvider}
 * * {@link PrinterServiceProvider}
 * * {@link ConfigurationServiceProvider}
 *
 * NOTE: The `ConfigurationServiceProvider` will not be added if the required `allow-read` and `allow-write`
 * permissions are not granted. It can also be excluded if desired via a constructor argument.
 *
 * By default the following commands are added:
 *
 * * {@link SingleCommandCliHelpSubCommand} or {@link MultiCommandCliHelpSubCommand}
 * * {@link SingleCommandCliHelpGlobalCommand} or {@link MultiCommandCliHelpGlobalCommand}
 * * commands provided by the {@link ConfigurationServiceProvider}.
 * * commands provided by the {@link PrinterServiceProvider}.
 */
export default class BaseCLI implements CLI {
  private readonly cliConfig: CLIConfig;
  private readonly stdoutWritable: WritableStream;
  private readonly stderrWritable: WritableStream;
  private readonly envVarsEnabled: boolean;
  private readonly configEnabled: boolean;
  private readonly keyValueServiceEnabled: boolean;
  private readonly addedNonModifierCommands: Array<Command>;
  private readonly serviceProviderRegistry: DefaultServiceProviderRegistry;
  private readonly commandRegistry: DefaultCommandRegistry;
  private readonly context: DefaultContext;

  /**
   * Constructor configures the instance with the specified CLI application details and WritableStream instances.
   *
   * @param cliConfig the {@link CLIConfig} for the CLI application.
   * @param stdoutWritableStream the WritableStream to use for stdout output.
   * @param stderrWritableStream the WritableStream to use for stderr output.
   * @param envVarsEnabled optionally support checking env variables for default argument values.
   * @param configEnabled optionally enable configuration file support for default argument values.
   * @param keyValueServiceEnabled optionally provide a {@link KeyValueService} implementation: `configEnabled` must be true in this case
   * @param validateAllCommands optionally force validation of all i.e. include validation of core commands.
   */
  constructor(
    cliConfig: CLIConfig,
    stdoutWritableStream: WritableStream,
    stderrWritableStream: WritableStream,
    envVarsEnabled = false,
    configEnabled = false,
    keyValueServiceEnabled = false,
    validateAllCommands = false,
  ) {
    if (cliConfig.name.length === 0) {
      throw new Error("Invalid empty CLI name provided");
    }
    if (cliConfig.name[0].match(/[0-9\-_]/)) {
      throw new Error(
        `Invalid CLI name starting with a digit or dash provided: '${cliConfig.name}'`,
      );
    }
    if (
      (cliConfig.description !== undefined) &&
      (cliConfig.description.length === 0)
    ) {
      throw new Error("Invalid empty CLI description provided");
    }
    if ((cliConfig.version !== undefined) && (cliConfig.version.length === 0)) {
      throw new Error("Invalid empty CLI version provided");
    }
    this.cliConfig = cliConfig;
    this.stdoutWritable = stdoutWritableStream;
    this.stderrWritable = stderrWritableStream;
    this.envVarsEnabled = envVarsEnabled;
    this.configEnabled = configEnabled;
    this.keyValueServiceEnabled = keyValueServiceEnabled;
    this.addedNonModifierCommands = [];

    // create a validator if required
    let commandValidator: CommandValidator | undefined;
    if (validateAllCommands) {
      commandValidator = new CommandValidator(this.cliConfig);
    }

    // create a service provider registry
    this.serviceProviderRegistry = new DefaultServiceProviderRegistry();

    // create a command registry
    this.commandRegistry = new DefaultCommandRegistry([], commandValidator);

    // create a context
    this.context = new DefaultContext(this.cliConfig);
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
    this.serviceProviderRegistry.addServiceProvider(serviceProvider);
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
      this.addedNonModifierCommands.push(command);
    }

    // register the command
    this.commandRegistry.addCommand(command);
  }

  async run(args: ReadonlyArray<string>): Promise<RunResult> {
    if (this.addedNonModifierCommands.length === 0) {
      throw new Error(
        "No non-modifier commands added to the CLI, nothing to run!",
      );
    }

    if (
      (this.addedNonModifierCommands.length === 1) &&
      !isSubCommand(this.addedNonModifierCommands[0]) &&
      !isGlobalCommand(this.addedNonModifierCommands[0])
    ) {
      throw new Error(
        "If only one command is added, if must be a global command or sub-command!",
      );
    }

    // create and add core services
    this.addServiceProvider(new ShutdownServiceProvider(100));
    this.addServiceProvider(
      new PrinterServiceProvider(
        80,
        this.stdoutWritable,
        this.stderrWritable,
      ),
    );

    const configurationServiceProvider = new ConfigurationServiceProvider(
      90,
      this.envVarsEnabled,
      this.configEnabled,
      this.keyValueServiceEnabled,
    );
    this.addServiceProvider(configurationServiceProvider);

    for (
      const serviceProvider of this.serviceProviderRegistry
        .getServiceProviders()
    ) {
      const serviceInfo = await serviceProvider.provide(this.cliConfig);

      if (serviceInfo.service) {
        this.context.addServiceInstance(
          serviceProvider.serviceId,
          serviceInfo.service,
        );
      }

      serviceInfo.commands.forEach((command) => {
        this.commandRegistry.addCommand(command, serviceProvider.serviceId);
      });
    }

    logger.debug(() => `Running with args: ${args.join(" ")}`);

    let helpSubCommand: SubCommand | undefined;
    let helpGlobalCommand: GlobalCommand | undefined;
    let defaultCommand: Command | undefined;

    try {
      // setup help commands and default command based on the number of commands explicitly added via {@link addCommand)
      if (this.addedNonModifierCommands.length === 1) {
        // a single-command CLI
        defaultCommand = this.addedNonModifierCommands[0];
        helpSubCommand = new SingleCommandCliHelpSubCommand(
          this.cliConfig,
          this.envVarsEnabled,
          defaultCommand as SubCommand,
          this.commandRegistry,
        );
        helpGlobalCommand = new SingleCommandCliHelpGlobalCommand(
          this.cliConfig,
          this.envVarsEnabled,
          defaultCommand as SubCommand,
          this.commandRegistry,
        );
      } else {
        // a multi-command CLI
        helpSubCommand = new MultiCommandCliHelpSubCommand(
          this.cliConfig,
          this.envVarsEnabled,
          this.commandRegistry,
        );
        helpGlobalCommand = new MultiCommandCliHelpGlobalCommand(
          this.cliConfig,
          this.envVarsEnabled,
          this.commandRegistry,
        );
        defaultCommand = helpGlobalCommand;
      }

      // register the help commands
      this.commandRegistry.addCommand(helpSubCommand);
      this.commandRegistry.addCommand(helpGlobalCommand);

      // run...
      const runResult = await run(
        args,
        this.commandRegistry,
        this.serviceProviderRegistry,
        configurationServiceProvider,
        this.context,
        defaultCommand,
      );
      // then handle the result...
      if (runResult.runState === RunState.NO_COMMAND) {
        await helpGlobalCommand.execute(this.context);
      } else if (runResult.runState === RunState.PARSE_ERROR) {
        if (
          (runResult.command !== undefined) && (
            isSubCommand(runResult.command) ||
            isGlobalCommand(runResult.command)
          )
        ) {
          await helpGlobalCommand.execute(
            this.context,
            runResult.command!.name,
          );
        } else {
          await helpGlobalCommand.execute(
            this.context,
          );
        }
      }
      return runResult;
    } catch (error) {
      // An unexpected error in the framework
      logger.error("Runtime error: %s", error.message);
      return {
        runState: RunState.RUNTIME_ERROR,
        error,
      };
    } finally {
      ShutdownServiceProvider.shutdown();
    }
  }
}
