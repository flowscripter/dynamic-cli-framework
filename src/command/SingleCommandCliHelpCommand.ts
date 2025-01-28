import type GlobalCommand from "../api/command/GlobalCommand.ts";
import type SubCommand from "../api/command/SubCommand.ts";
import type Option from "../api/argument/Option.ts";
import type Positional from "../api/argument/Positional.ts";
import type Context from "../api/Context.ts";
import {
  getCommandArgsHelpSections,
  getCommandExamplesHelpSections,
  getGlobalArgumentHelpEntry,
  getSubCommandArgumentsSyntax,
  type HelpEntry,
  type HelpSection,
  printHelpSections,
} from "../util/helpHelper.ts";
import type GlobalModifierCommand from "../api/command/GlobalModifierCommand.ts";
import type GroupCommand from "../api/command/GroupCommand.ts";
import type CommandRegistry from "../runtime/registry/CommandRegistry.ts";
import type PrinterService from "../api/service/core/PrinterService.ts";
import { PRINTER_SERVICE_ID } from "../api/service/core/PrinterService.ts";

/**
 * Provides common implementation for both {@link SingleCommandCliHelpGlobalCommand} and {@link SingleCommandCliHelpSubCommand}.
 */
abstract class SingleCommandCliAbstractHelpCommand {
  readonly #includeEnvVars: boolean;
  readonly #defaultCommand: SubCommand;
  readonly #commandRegistry: CommandRegistry;

  constructor(
    includeEnvVars: boolean,
    defaultCommand: SubCommand,
    commandRegistry: CommandRegistry,
  ) {
    this.#includeEnvVars = includeEnvVars;
    this.#defaultCommand = defaultCommand;
    this.#commandRegistry = commandRegistry;
  }

  readonly name = "help";

  readonly description = "Display application help";

  #getAmalgamatedGenericHelpSection(
    context: Context,
    globalModifierCommands: ReadonlyArray<GlobalModifierCommand>,
    globalCommands: ReadonlyArray<GlobalCommand>,
    groupCommands: ReadonlyArray<GroupCommand>,
    subCommands: ReadonlyArray<SubCommand>,
  ): HelpSection {
    const helpSection: HelpSection = {
      title: "Other Arguments",
      helpEntries: [],
    };
    if (globalModifierCommands.length > 0) {
      globalModifierCommands.forEach((globalModifierCommand) => {
        const { syntax, description } = getGlobalArgumentHelpEntry(
          context.cliConfig,
          this.#includeEnvVars,
          globalModifierCommand,
        );
        helpSection.helpEntries.push({
          syntax: `--${globalModifierCommand.name} ${syntax}`,
          description,
        });
        if (globalModifierCommand.shortAlias !== undefined) {
          helpSection.helpEntries.push({
            syntax: `-${globalModifierCommand.shortAlias} ${syntax}`,
            description,
          });
        }
      });
    }
    if (globalCommands.length > 0) {
      globalCommands.forEach((globalCommand) => {
        const { syntax, description } = getGlobalArgumentHelpEntry(
          context.cliConfig,
          this.#includeEnvVars,
          globalCommand,
        );
        helpSection.helpEntries.push({
          syntax: `--${globalCommand.name} ${syntax}`,
          description,
        });
        if (globalCommand.shortAlias !== undefined) {
          helpSection.helpEntries.push({
            syntax: `-${globalCommand.shortAlias} ${syntax}`,
            description,
          });
        }
      });
    }
    groupCommands.forEach((groupCommand) => {
      groupCommand.memberSubCommands.forEach((memberCommand: SubCommand) => {
        helpSection.helpEntries.push({
          syntax: `${groupCommand.name}:${memberCommand.name}`,
          description: memberCommand.description,
        });
      });
    });
    if (subCommands.length > 0) {
      subCommands.forEach((subCommand) => {
        helpSection.helpEntries.push({
          syntax: subCommand.name,
          description: subCommand.description,
        });
      });
    }
    helpSection.helpEntries.sort((a: HelpEntry, b: HelpEntry) =>
      a.syntax.localeCompare(b.syntax)
    );
    return helpSection;
  }

  public async execute(
    context: Context,
  ): Promise<void> {
    const helpSections: Array<HelpSection> = [];
    helpSections.push({
      title: "Usage",
      helpEntries: [{
        syntax: `${context.cliConfig.name || ""}${
          getSubCommandArgumentsSyntax(this.#defaultCommand)
        }`,
      }],
    });

    helpSections.push(
      ...getCommandArgsHelpSections(
        context.cliConfig,
        this.#includeEnvVars,
        this.#defaultCommand,
        true,
      ),
    );

    const globalModifierCommands = this.#commandRegistry
      .getGlobalModifierCommands();
    const globalCommands = this.#commandRegistry.getGlobalCommands();
    helpSections.push(
      this.#getAmalgamatedGenericHelpSection(
        context,
        globalModifierCommands,
        globalCommands,
        [],
        [],
      ),
    );

    const printerService = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as PrinterService;

    helpSections.push(
      ...getCommandExamplesHelpSections(
        printerService,
        context,
        this.#defaultCommand,
      ),
    );

    await printHelpSections(printerService, helpSections);
  }
}

/**
 * Implementation of default command CLI help available via `myCli --help` or `myCli -h`.
 */
export class SingleCommandCliHelpGlobalCommand
  extends SingleCommandCliAbstractHelpCommand
  implements GlobalCommand {
  readonly shortAlias = "h";
}

/**
 * Implementation of default-command CLI help available via `myCli help`.
 */
export class SingleCommandCliHelpSubCommand
  extends SingleCommandCliAbstractHelpCommand
  implements SubCommand {
  public readonly options: ReadonlyArray<Option> = [];

  public readonly positionals: ReadonlyArray<Positional> = [];
}
