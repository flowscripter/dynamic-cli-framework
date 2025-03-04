import type Positional from "../api/argument/Positional.ts";
import type Option from "../api/argument/Option.ts";
import type SubCommand from "../api/command/SubCommand.ts";
import type GlobalCommand from "../api/command/GlobalCommand.ts";
import type GroupCommand from "../api/command/GroupCommand.ts";
import { distance } from "fastest-levenshtein";
import {
  type ArgumentSingleValueType,
  type ArgumentValues,
  ArgumentValueTypeName,
} from "../api/argument/ArgumentValueTypes.ts";
import type Context from "../api/Context.ts";
import type { HelpSection } from "../util/helpHelper.ts";
import {
  getCommandArgsHelpSections,
  getCommandExamplesHelpSections,
  getGlobalArgumentHelpEntry,
  getMultiCommandAppSyntax,
  getSubCommandArgumentsSyntax,
  printHelpSections,
} from "../util/helpHelper.ts";
import type GlobalModifierCommand from "../api/command/GlobalModifierCommand.ts";
import type CommandRegistry from "../runtime/registry/CommandRegistry.ts";
import type PrinterService from "../api/service/core/PrinterService.ts";
import {
  Icon,
  PRINTER_SERVICE_ID,
} from "../api/service/core/PrinterService.ts";

/**
 * Provides common implementation for both {@link MultiCommandCliHelpGlobalCommand} and {@link MultiCommandCliHelpSubCommand}.
 */
abstract class MultiCommandCliAbstractHelpCommand {
  readonly name = "help";
  readonly description = "Display application help";
  readonly #includeEnvVars: boolean;
  readonly #commandRegistry: CommandRegistry;

  constructor(
    includeEnvVars: boolean,
    commandRegistry: CommandRegistry,
  ) {
    this.#includeEnvVars = includeEnvVars;
    this.#commandRegistry = commandRegistry;
  }

  #findPossibleCommandNames(
    commandName: string,
    groupCommands: ReadonlyArray<GroupCommand>,
    subCommands: ReadonlyArray<SubCommand>,
  ): string[] {
    const levenCommandArray = new Array<[number, string]>();
    subCommands.forEach((subCommand) => {
      levenCommandArray.push([
        distance(subCommand.name, commandName),
        subCommand.name,
      ]);
    });
    groupCommands.forEach((groupCommand) => {
      groupCommand.memberSubCommands.forEach((memberCommand) => {
        const memberName = `${groupCommand.name}:${memberCommand.name}`;
        levenCommandArray.push([
          distance(memberName, commandName),
          memberName,
        ]);
      });
    });
    return levenCommandArray
      .sort((a, b) => a[0] - b[0])
      .slice(0, 2)
      .filter((value) => value[0] < 3)
      .map((value) => value[1]);
  }

  #getGlobalCommandsHelpSection(
    context: Context,
    title: string,
    globalCommands: ReadonlyArray<GlobalCommand>,
  ): HelpSection {
    const globalCommandsSection: HelpSection = {
      title,
      helpEntries: [],
    };
    globalCommands.forEach((globalCommand) => {
      const { syntax, description } = getGlobalArgumentHelpEntry(
        context.cliConfig,
        this.#includeEnvVars,
        globalCommand,
      );
      globalCommandsSection.helpEntries.push({
        syntax: `--${globalCommand.name} ${syntax}`,
        description,
      });
      if (globalCommand.shortAlias !== undefined) {
        globalCommandsSection.helpEntries.push({
          syntax: `-${globalCommand.shortAlias} ${syntax}`,
          description,
        });
      }
    });
    globalCommandsSection.helpEntries.sort((a, b) =>
      a.syntax.localeCompare(b.syntax)
    );
    return globalCommandsSection;
  }

  #getGenericHelpSections(
    context: Context,
    globalModifierCommands: ReadonlyArray<GlobalModifierCommand>,
    globalCommands: ReadonlyArray<GlobalCommand>,
    groupCommands: ReadonlyArray<GroupCommand>,
    subCommands: ReadonlyArray<SubCommand>,
  ): Array<HelpSection> {
    const globalPrefix =
      ((groupCommands.length > 0) || (subCommands.length > 0)) ? "Global " : "";
    const helpSections: HelpSection[] = [];
    if (globalModifierCommands.length > 0) {
      helpSections.push(
        this.#getGlobalCommandsHelpSection(
          context,
          `${globalPrefix}Options`,
          globalModifierCommands,
        ),
      );
    }
    if (globalCommands.length > 0) {
      helpSections.push(
        this.#getGlobalCommandsHelpSection(
          context,
          `${globalPrefix}Commands`,
          globalCommands,
        ),
      );
    }
    groupCommands.forEach((groupCommand) => {
      const topicSection: HelpSection = {
        title: `${
          groupCommand.name.charAt(0).toUpperCase() + groupCommand.name.slice(1)
        } Commands`,
        helpEntries: [],
      };
      groupCommand.memberSubCommands.forEach((memberCommand) => {
        topicSection.helpEntries.push({
          syntax: `${groupCommand.name}:${memberCommand.name}`,
          description: memberCommand.description,
        });
      });
      topicSection.helpEntries.sort((a, b) => a.syntax.localeCompare(b.syntax));
      helpSections.push(topicSection);
    });
    if (subCommands.length > 0) {
      const subCommandsByTopic = new Map<string, SubCommand[]>();
      const otherSubCommands: SubCommand[] = [];

      subCommands.forEach((subCommand) => {
        if (subCommand.helpTopic === undefined) {
          otherSubCommands.push(subCommand);
        } else {
          const commands = subCommandsByTopic.get(subCommand.helpTopic) || [];
          commands.push(subCommand);
          subCommandsByTopic.set(subCommand.helpTopic, commands);
        }
      });

      for (const key of subCommandsByTopic.keys()) {
        const topicCommands = subCommandsByTopic.get(key);
        if (topicCommands !== undefined) {
          const topicSection: HelpSection = {
            title: `${key.charAt(0).toUpperCase() + key.slice(1)} Commands`,
            helpEntries: [],
          };
          topicCommands.sort((a, b) => a.name.localeCompare(b.name));
          topicCommands.forEach((subCommand) => {
            topicSection.helpEntries.push({
              syntax: subCommand.name,
              description: subCommand.description,
            });
          });
          helpSections.push(topicSection);
        }
      }

      if (otherSubCommands.length > 0) {
        const topicSection: HelpSection = {
          title: (subCommandsByTopic.size > 0 || groupCommands.length > 0)
            ? "Other Commands"
            : "Sub-Commands",
          helpEntries: [],
        };
        otherSubCommands.sort((a, b) => a.name.localeCompare(b.name));
        otherSubCommands.forEach((subCommand) => {
          topicSection.helpEntries.push({
            syntax: subCommand.name,
            description: subCommand.description,
          });
        });
        helpSections.push(topicSection);
      }
    }
    return helpSections;
  }

  protected async printGenericHelp(
    context: Context,
  ): Promise<void> {
    const printerService = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as PrinterService;

    const globalModifierCommands = this.#commandRegistry
      .getGlobalModifierCommands();
    const globalCommands = this.#commandRegistry.getGlobalCommands();
    const groupCommands = this.#commandRegistry.getGroupCommands();
    const subCommands = this.#commandRegistry.getSubCommands();
    const helpSections: Array<HelpSection> = [];
    helpSections.push({
      title: "Usage",
      helpEntries: [
        {
          syntax: getMultiCommandAppSyntax(
            context,
            globalModifierCommands,
            globalCommands,
            groupCommands,
            subCommands,
          ),
        },
      ],
    });

    helpSections.push(
      ...this.#getGenericHelpSections(
        context,
        globalModifierCommands,
        globalCommands,
        groupCommands,
        subCommands,
      ),
    );

    await printHelpSections(printerService, helpSections);
  }

  protected async printUsageHelp(
    context: Context,
    commandName: string,
  ): Promise<void> {
    const printerService = context.getServiceById(
      PRINTER_SERVICE_ID,
    ) as PrinterService;

    const groupCommands = this.#commandRegistry.getGroupCommands();
    const subCommands = this.#commandRegistry.getSubCommands();

    // find sub-command or group sub-command
    let subCommand = this.#commandRegistry.getSubCommandByName(commandName);

    let groupCommand: GroupCommand | undefined;

    if (subCommand === undefined) {
      const result = this.#commandRegistry
        .getGroupCommandAndMemberSubCommandByJoinedName(commandName);
      if (result !== undefined) {
        groupCommand = result.groupCommand;
        subCommand = result.command;
      }
    }

    if (subCommand === undefined) {
      await printerService.print(
        `Unknown command: ${printerService.red(commandName)}\n\n`,
        Icon.FAILURE,
      );

      // look for other possible matches
      const possibleCommandNames = this.#findPossibleCommandNames(
        commandName,
        groupCommands,
        subCommands,
      );
      if (possibleCommandNames.length > 0) {
        await printerService.print(
          `Possible matches: ${possibleCommandNames.join(", ")}\n\n`,
          Icon.INFORMATION,
        );
      }
      await this.printGenericHelp(context);
      return;
    }

    // display command help
    const name = (groupCommand === undefined)
      ? subCommand.name
      : `${groupCommand.name}:${subCommand.name}`;
    const helpSections: HelpSection[] = [];

    if (
      (subCommand.description !== undefined) &&
      (subCommand.description.length > 0)
    ) {
      helpSections.push({
        title: "Command",
        helpEntries: [{
          syntax: subCommand.name,
          description: subCommand.description,
        }],
      });
    }
    helpSections.push({
      title: "Usage",
      helpEntries: [{
        syntax: `${context.cliConfig.name}${name.length > 0 ? ` ${name}` : ""}${
          getSubCommandArgumentsSyntax(subCommand)
        }`,
      }],
    });

    helpSections.push(
      ...getCommandArgsHelpSections(
        context.cliConfig,
        this.#includeEnvVars,
        subCommand,
        false,
      ),
    );

    helpSections.push(
      ...getCommandExamplesHelpSections(printerService, context, subCommand),
    );

    await printHelpSections(printerService, helpSections);
  }
}

/**
 * Implementation of multi-command CLI help available via `myCli --help`, `myCli -h`, `myCli --help <command>` or `myCli -h <command>`.
 */
export class MultiCommandCliHelpGlobalCommand
  extends MultiCommandCliAbstractHelpCommand
  implements GlobalCommand {
  readonly shortAlias = "h";

  readonly argument = {
    name: "command",
    type: ArgumentValueTypeName.STRING,
    isOptional: true,
  };

  public async execute(
    context: Context,
    argumentValue?: ArgumentSingleValueType,
  ): Promise<void> {
    const commandName = argumentValue as
      | string
      | undefined;
    if (commandName !== undefined) {
      await this.printUsageHelp(context, commandName);
    } else {
      await this.printGenericHelp(context);
    }
  }
}

/**
 * Implementation of multi-command CLI help available via `myCli help` or `myCli help <command>`.
 */
export class MultiCommandCliHelpSubCommand
  extends MultiCommandCliAbstractHelpCommand
  implements SubCommand {
  public readonly options: ReadonlyArray<Option> = [];

  public readonly positionals: ReadonlyArray<Positional> = [
    {
      name: "command",
      type: ArgumentValueTypeName.STRING,
      isVarargOptional: true,
      description: "Display help for the specific <command>",
    },
  ];

  public async execute(
    context: Context,
    argumentValues: ArgumentValues,
  ): Promise<void> {
    const commandName = argumentValues["command"] as
      | string
      | undefined;
    if (commandName !== undefined) {
      await this.printUsageHelp(context, commandName);
    } else {
      await this.printGenericHelp(context);
    }
  }
}
