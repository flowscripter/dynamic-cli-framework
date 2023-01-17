import CLI from "./api/CLI.ts";
import RunResult, { RunState } from "./api/RunResult.ts";
import getLogger from "./util/logger.ts";
import DefaultRunner from "./runtime/DefaultRunner.ts";
import DefaultParser from "./runtime/DefaultParser.ts";
import DefaultCommandRegistry from "./runtime/registry/DefaultCommandRegistry.ts";
import { NonModifierCommand } from "./api/command/NonModifierCommand.ts";
import Command from "./api/command/Command.ts";
import DefaultServiceRegistry from "./runtime/registry/DefaultServiceRegistry.ts";
import DefaultContext from "./runtime/DefaultContext.ts";
import ServiceProvider, { ServiceInfo } from "./api/service/ServiceProvider.ts";
import PrinterService from "./service/core/PrinterService.ts";
import ConfigurationService from "./service/core/ConfigurationService.ts";
import BannerCommand from "./command/core/BannerCommand.ts";
import NoBannerCommand from "./command/core/NoBannerCommand.ts";
import CLIConfig from "./api/CLIConfig.ts";
import LifecycleService from "./service/core/LifecycleService.ts";
import SubCommand from "./api/command/SubCommand.ts";
import GlobalCommand from "./api/command/GlobalCommand.ts";
import {
  SingleCommandCliHelpGlobalCommand,
  SingleCommandCliHelpSubCommand,
} from "./command/core/SingleCommandCliHelpCommand.ts";
import {
  MultiCommandCliHelpGlobalCommand,
  MultiCommandCliHelpSubCommand,
} from "./command/core/MultiCommandCliHelpCommand.ts";
import GlobalModifierCommand from "./api/command/GlobalModifierCommand.ts";
import {
  isGlobalModifierCommand,
  isNonModifierCommand,
  isSubCommand,
} from "./api/command/CommandTypeGuards.ts";
import CommandValidator from "./runtime/command/CommandValidator.ts";

const logger = getLogger("AbstractBaseCLI");

/**
 * Base implementation of a {@link CLI}.
 *
 * By default the following services are added:
 *
 * * {@link LifecycleService} - added to the context under {@link LIFECYCLE_SERVICE_ID}.
 * * {@link ConfigurationService}
 * * {@link PrinterService} - added to the context under {@link PRINTER_SERVICE_ID}.
 *
 * By default the following commands are added:
 *
 * * {@link SingleCommandCliHelpSubCommand} or {@link MultiCommandCliHelpSubCommand}
 * * {@link SingleCommandCliHelpGlobalCommand} or {@link MultiCommandCliHelpGlobalCommand}
 * * {@link NoBannerCommand}
 * * commands provided by the {@link ConfigurationService}.
 * * commands provided by the {@link PrinterService}.
 *
 * The following {@link GlobalModifierCommand} instances are run by default:
 *
 * * {@link BannerCommand}
 */
export default abstract class AbstractBaseCLI implements CLI {
  private readonly cliConfig: CLIConfig;
  private readonly stdoutWriter: Deno.Writer;
  private readonly stderrWriter: Deno.Writer;
  private readonly serviceRegistry: DefaultServiceRegistry;
  private readonly addedModifierCommands: Array<GlobalModifierCommand>;
  private readonly addedNonModifierCommands: Array<NonModifierCommand>;

  /**
   * Constructor configures the instance with the specified CLI application details and Writer instances.
   *
   * @param cliConfig the {@link CLIConfig} for the CLI application.
   * @param stdoutWriter the Writer to use for stdout output.
   * @param stderrWriter the Writer to use for stderr output.
   */
  public constructor(
    cliConfig: CLIConfig,
    stdoutWriter: Deno.Writer,
    stderrWriter: Deno.Writer,
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
    this.stdoutWriter = stdoutWriter;
    this.stderrWriter = stderrWriter;
    this.serviceRegistry = new DefaultServiceRegistry();
    this.addedModifierCommands = [];
    this.addedNonModifierCommands = [];
  }

  /**
   * Add a {@link ServiceProvider} to the CLI's {@link ServiceRegistry}.
   *
   * @param service the {@link ServiceProvider} to add.
   */
  public addService(service: ServiceProvider) {
    this.serviceRegistry.addService(service);
  }

  /**
   * Add a {@link Command} to the CLI's {@link CommandRegistry}.
   *
   * If only one command is added, the CLI will operate as a single command CLI and the provided command will
   * be set as a default command.
   *
   * If more than one command is added, the CLI will operate as a multi-command CLI. In this case the default
   * command will be set to a help command.
   *
   * @param command the {@link Command} to add.
   */
  public addCommand(command: Command) {
    if (isGlobalModifierCommand(command)) {
      this.addedModifierCommands.push(command);
    } else {
      this.addedNonModifierCommands.push(command);
    }
  }

  async run(args: ReadonlyArray<string>): Promise<RunResult> {
    try {
      logger.debug(() => `Running with args: ${args.join(" ")}`);

      // determine if the CLI should operate as a single command or multi-command CLI
      // this would be a pretty lame no-command CLI
      if (this.addedNonModifierCommands.length === 0) {
        throw new Error(
          "No non-modifier commands added to the CLI, nothing to run!",
        );
      }

      // create and add core services
      this.addService(new LifecycleService(100));
      const configurationService = new ConfigurationService(90);
      this.addService(configurationService);
      this.addService(
        new PrinterService(80, this.stdoutWriter, this.stderrWriter),
      );

      // create a validator if required
      let commandValidator: CommandValidator | undefined;
      if (Deno.env.get("CLI_VALIDATE_ALL") !== undefined) {
        commandValidator = new CommandValidator(this.cliConfig);
      }

      // create a command registry
      const commandRegistry = new DefaultCommandRegistry([], commandValidator);

      // create a context
      const context = new DefaultContext(this.cliConfig);

      // init the services, add any provided service instances to context and register any provided commands
      for (const service of this.serviceRegistry.getServices()) {
        // TODO: SOLVE return post init default run commands here and make sure they are validated as they aren't
        //  added to command registry - should validate no options as they can't have args passed to them.
        const { serviceInstances, commands } = await service.init(context);

        serviceInstances.forEach((serviceInstance: ServiceInfo) => {
          logger.debug(() =>
            `Adding service instance with ID: ${serviceInstance.serviceId} to context`
          );
          context.addServiceInstance(
            serviceInstance.serviceId,
            serviceInstance.instance,
          );
        });
        commands.forEach((command: Command) =>
          commandRegistry.addCommand(command)
        );
      }

      // setup help and default commands based on the commands explicitly added via {@link addCommand).
      let helpSubCommand: SubCommand | undefined;
      let helpGlobalCommand: GlobalCommand | undefined;
      let defaultCommand: NonModifierCommand | undefined;

      // a single-command CLI
      // TODO: SOLVE implement Help Service and add commands via that
      if (this.addedNonModifierCommands.length === 1) {
        defaultCommand = this.addedNonModifierCommands[0];
        if (!isSubCommand(defaultCommand)) {
          throw new Error(
            "If only one command is provided if must be a sub-command!",
          );
        }
        helpSubCommand = new SingleCommandCliHelpSubCommand(
          this.cliConfig,
          defaultCommand,
          commandRegistry,
        );
        helpGlobalCommand = new SingleCommandCliHelpGlobalCommand(
          this.cliConfig,
          defaultCommand,
          commandRegistry,
        );
      } // a multi-command CLI
      else {
        helpSubCommand = new MultiCommandCliHelpSubCommand(
          this.cliConfig,
          commandRegistry,
        );
        helpGlobalCommand = new MultiCommandCliHelpGlobalCommand(
          this.cliConfig,
          commandRegistry,
        );
        defaultCommand = helpGlobalCommand;
      }

      // banner commands
      // TODO: SOLVE implement service returning post init default run command - add to PrinterService or Banner Service
      const printBannerCommand = new BannerCommand(60);
      // TODO: SOLVE implement service returning post init default run command - add to PrinterService or Banner Service
      const noBannerCommand = new NoBannerCommand(printBannerCommand, 70);

      // validate commands
      if (commandValidator !== undefined) {
        commandValidator.validate(printBannerCommand);
      }

      // register modifier commands
      commandRegistry.addCommand(noBannerCommand);
      this.addedModifierCommands.forEach((command) =>
        commandRegistry.addCommand(command)
      );

      // register non-modifier commands
      commandRegistry.addCommand(helpSubCommand);
      commandRegistry.addCommand(helpGlobalCommand);
      this.addedNonModifierCommands.forEach((command) =>
        commandRegistry.addCommand(command)
      );

      // create the runner...
      const runner = new DefaultRunner(new DefaultParser());

      // and run...
      const runResult = await runner.run(
        args,
        commandRegistry,
        // TODO: SOLVE implement config service access - via context?
        configurationService.configuredArgumentValuesByCommandName,
        context,
        // TODO: SOLVE implement service returning post init default run command and pass all here
        [printBannerCommand],
        defaultCommand,
      );

      if (runResult.runState === RunState.NO_COMMAND) {
        await helpGlobalCommand.execute({}, context);
      } else if (runResult.runState === RunState.PARSE_ERROR) {
        if (
          (runResult.command !== undefined) &&
          isNonModifierCommand(runResult.command)
        ) {
          await helpGlobalCommand.execute(
            { command: runResult.command!.name },
            context,
          );
        } else {
          await helpGlobalCommand.execute(
            {},
            context,
          );
        }
      }
      return runResult;
    } catch (error) {
      logger.debug(`Runtime error: ${error.message}`);
      return {
        runState: RunState.RUNTIME_ERROR,
        error,
      };
    }
  }
}
