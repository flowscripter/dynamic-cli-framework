import Printer from "../../api/service/core/Printer.ts";
import GlobalCommand from "../../api/command/GlobalCommand.ts";
import GlobalCommandArgument from "../../api/argument/GlobalCommandArgument.ts";
import {
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "../../api/argument/ArgumentValueTypes.ts";
import SubCommand from "../../api/command/SubCommand.ts";
import Context from "../../api/Context.ts";
import UsageExample from "../../api/command/UsageExample.ts";
import Option from "../../api/argument/Option.ts";
import Positional from "../../api/argument/Positional.ts";
import GlobalModifierCommand from "../../api/command/GlobalModifierCommand.ts";
import GroupCommand from "../../api/command/GroupCommand.ts";
import { ComplexOption } from "../../../mod.ts";
import { getConfigurationKey } from "../../util/configHelper.ts";
import Command from "../../api/command/Command.ts";
import CLIConfig from "../../api/CLIConfig.ts";
import Argument from "../../api/argument/Argument.ts";

const SYNTAX_INDENT_WIDTH = 2;
const SYNTAX_MIN_PADDING_WIDTH = 2;
const MINIMUM_SYNTAX_COLUMN_WIDTH = 15;
const HELP_SYNTAX_INDENT = " ".repeat(SYNTAX_INDENT_WIDTH);
const HELP_SYNTAX_PADDING = " ".repeat(SYNTAX_MIN_PADDING_WIDTH);

export interface HelpEntry {
  readonly syntax: string;
  readonly description?: string;
  readonly subEntryIndent?: number;
  readonly helpSubEntries?: Array<HelpEntry>;
}

export interface HelpSection {
  readonly title: string;
  readonly helpEntries: Array<HelpEntry>;
}

async function printSingleHelpEntry(
  printer: Printer,
  helpEntry: HelpEntry,
  syntaxWidth: number,
  indentText: string,
  isRoot: boolean,
  isLastSibling: boolean,
): Promise<void> {
  let text = "";
  const notesIndent = syntaxWidth;
  let syntaxTreeChars = "";
  let totalSyntaxLength = 0;

  if (helpEntry.syntax) {
    if (isRoot) {
      text += HELP_SYNTAX_INDENT + printer.primary(helpEntry.syntax);
      totalSyntaxLength = SYNTAX_INDENT_WIDTH + helpEntry.syntax.length;
    } else {
      if (indentText.length > 0) {
        syntaxTreeChars = isLastSibling ? "└╴" : "├╴";
      }
      text += HELP_SYNTAX_INDENT +
        printer.secondary(indentText + syntaxTreeChars) +
        printer.primary(helpEntry.syntax);
      totalSyntaxLength = SYNTAX_INDENT_WIDTH + indentText.length +
        syntaxTreeChars.length + helpEntry.syntax.length;
    }
  }
  if (helpEntry.description) {
    if (helpEntry.syntax) {
      if (totalSyntaxLength > notesIndent) {
        text += HELP_SYNTAX_PADDING + printer.secondary(helpEntry.description);
      } else {
        text += " ".repeat(syntaxWidth - totalSyntaxLength) +
          printer.secondary(helpEntry.description);
      }
    } else {
      text += HELP_SYNTAX_PADDING + printer.secondary(helpEntry.description);
    }
  }
  text += "\n";
  await printer.print(text);
}

async function printHelpEntry(
  printer: Printer,
  helpEntry: HelpEntry,
  syntaxWidth: number,
  indentText: string,
  isRoot: boolean,
  hasChildren: boolean,
  isLastSibling: boolean,
): Promise<void> {
  if (hasChildren) {
    await printSingleHelpEntry(
      printer,
      helpEntry,
      syntaxWidth,
      indentText,
      isRoot,
      isLastSibling,
    );
    indentText += (isLastSibling ? "  " : "│ ") +
      " ".repeat(helpEntry.subEntryIndent || 0);
    for (let i = 0; i < helpEntry.helpSubEntries!.length; i++) {
      const helpSubEntry = helpEntry.helpSubEntries![i];
      const helpSubEntryHasChildren =
        (helpSubEntry.helpSubEntries !== undefined);
      const helpSubEntryIsLastSibling =
        (i === helpEntry.helpSubEntries!.length - 1);
      await printHelpEntry(
        printer,
        helpSubEntry,
        syntaxWidth,
        indentText,
        false,
        helpSubEntryHasChildren,
        helpSubEntryIsLastSibling,
      );
    }
  } else {
    await printSingleHelpEntry(
      printer,
      helpEntry,
      syntaxWidth,
      indentText,
      isRoot,
      isLastSibling,
    );
  }
}

function getSyntaxWidth(helpEntry: HelpEntry, indent: number): number {
  if (
    (helpEntry.helpSubEntries === undefined) ||
    (helpEntry.helpSubEntries.length === 0)
  ) {
    // 2 is for the tree characters
    let finalWidth = SYNTAX_INDENT_WIDTH + indent + 2 +
      SYNTAX_MIN_PADDING_WIDTH;
    if (helpEntry.syntax) {
      finalWidth += helpEntry.syntax.length;
    }
    return finalWidth;
  }
  let maxSubIndent = 0;
  helpEntry.helpSubEntries.forEach((helpSubEntry) => {
    // 2 is for the tree characters
    const subEntryWidth = getSyntaxWidth(
      helpSubEntry,
      (helpEntry.subEntryIndent ? helpEntry.subEntryIndent : 0) + 2,
    );
    if (subEntryWidth > maxSubIndent) {
      maxSubIndent = subEntryWidth;
    }
  });
  return indent + maxSubIndent;
}

export async function printHelpSections(
  printer: Printer,
  sections: Array<HelpSection>,
): Promise<void> {
  // calculate alignment
  let syntaxWidth = SYNTAX_INDENT_WIDTH + MINIMUM_SYNTAX_COLUMN_WIDTH +
    SYNTAX_MIN_PADDING_WIDTH;
  sections.forEach((section) => {
    section.helpEntries.forEach((helpEntry) => {
      const entrySyntaxWidth = getSyntaxWidth(helpEntry, 0);
      // don't expand out if no description as we can overwrite that space on the line
      if (
        helpEntry.description && (helpEntry.description.length > 0) &&
        (entrySyntaxWidth > syntaxWidth)
      ) {
        syntaxWidth = entrySyntaxWidth;
      }
    });
  });

  // print the help
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (section.title.length > 0) {
      await printer.print(`${printer.emphasised(section.title)}\n\n`);
    }
    for (let j = 0; j < section.helpEntries.length; j++) {
      const helpEntry = section.helpEntries[j];
      await printHelpEntry(
        printer,
        helpEntry,
        syntaxWidth,
        "",
        true,
        helpEntry.helpSubEntries !== undefined,
        true,
      );
    }
    if (section.helpEntries.length > 0) {
      await printer.print("\n");
    }
  }
}

function getGlobalCommandArgumentForm(argument: GlobalCommandArgument): string {
  let argumentSyntax;
  if (argument.type === ArgumentValueTypeName.BOOLEAN) {
    argumentSyntax = "true|false";
  } else {
    argumentSyntax = `<${argument.name}>`;
  }
  if (argument.isOptional || argument.type === ArgumentValueTypeName.BOOLEAN) {
    argumentSyntax = `[${argumentSyntax}]`;
  }
  return argumentSyntax;
}

export function getGlobalArgumentHelpEntry(
  cliConfig: CLIConfig,
  globalCommand: GlobalCommand,
): HelpEntry {
  const { argument } = globalCommand;

  let description = globalCommand.description || "";
  if (argument === undefined) {
    return { syntax: "", description };
  }

  const syntax = getGlobalCommandArgumentForm(argument);

  const notesItems: Array<string> = [];
  if (
    (argument.allowableValues !== undefined) &&
    (argument.allowableValues.length > 0)
  ) {
    notesItems.push(`valid values: ${argument.allowableValues.join("|")}`);
  } else {
    switch (argument.type) {
      case ArgumentValueTypeName.STRING:
        notesItems.push("string value");
        break;
      case ArgumentValueTypeName.INTEGER:
        notesItems.push("integer value");
        break;
      case ArgumentValueTypeName.NUMBER:
        notesItems.push("number value");
        break;
    }
  }

  if (argument.defaultValue !== undefined) {
    notesItems.push(`default: ${argument.defaultValue}`);
  }

  const configurationKey = getConfigurationKey(
    cliConfig,
    globalCommand,
    [argument],
  );
  if (configurationKey !== undefined) {
    notesItems.push(`env var: ${configurationKey}`);
  }

  if (notesItems.length > 0) {
    if (description.length === 0) {
      description = `(${notesItems.join(", ")})`;
    } else {
      description = `${description} (${notesItems.join(", ")})`;
    }
  }
  return { syntax, description };
}

export function getSubCommandArgumentsSyntax(subCommand: SubCommand): string {
  let syntax = "";

  subCommand.options.forEach((option) => {
    let optionSyntax = `--${option.name}`;
    switch (option.type as ArgumentValueTypeName | ComplexValueTypeName) {
      case ArgumentValueTypeName.BOOLEAN:
        optionSyntax = `${optionSyntax} [true|false]`;
        break;
      case ArgumentValueTypeName.INTEGER:
        optionSyntax = `${optionSyntax} <integer_value>`;
        break;
      case ArgumentValueTypeName.NUMBER:
        optionSyntax = `${optionSyntax} <number_value>`;
        break;
      case ArgumentValueTypeName.STRING:
        optionSyntax = `${optionSyntax} <string_value>`;
        break;
      case ComplexValueTypeName.COMPLEX:
        optionSyntax = `${optionSyntax} <complex_value>`;
        break;
    }
    if (option.isOptional || (option.defaultValue !== undefined)) {
      optionSyntax = ` [${optionSyntax}]`;
    } else {
      optionSyntax = ` ${optionSyntax}`;
    }
    if (option.isArray) {
      optionSyntax = `${optionSyntax}...`;
    }
    syntax = `${syntax}${optionSyntax}`;
  });

  subCommand.positionals.forEach((positional) => {
    let positionalSyntax = `<${positional.name}>`;
    if (positional.isVarargOptional) {
      positionalSyntax = ` [${positionalSyntax}]`;
    } else {
      positionalSyntax = ` ${positionalSyntax}`;
    }
    if (positional.isVarargMultiple) {
      positionalSyntax = `${positionalSyntax}...`;
    }
    syntax = `${syntax}${positionalSyntax}`;
  });

  return syntax;
}

function getOptionHelpEntry(
  cliConfig: CLIConfig,
  command: Command,
  option: Option | ComplexOption,
  subEntryIndent = 0,
  optionAncestry: Array<Option | ComplexOption> = [],
): HelpEntry {
  let subEntries: Array<HelpEntry> | undefined;
  let optionCharacters = "--";
  let aliasCharacter = "-";
  let newSubEntryIndent = option.name.length;
  if (subEntryIndent > 0) {
    optionCharacters = ".";
    aliasCharacter = ".";
    newSubEntryIndent += 1;
  }

  const notesItems: Array<string> = [];
  if (option.type === ComplexValueTypeName.COMPLEX) {
    subEntries = [];
    option.properties.forEach((property) => {
      subEntries!.push(
        getOptionHelpEntry(
          cliConfig,
          command,
          property,
          newSubEntryIndent,
          [...optionAncestry, option],
        ),
      );
    });
  } else {
    if (
      (option.allowableValues !== undefined) &&
      (option.allowableValues.length > 0)
    ) {
      notesItems.push(`valid values: ${option.allowableValues.join("|")}`);
    } else {
      switch (option.type) {
        case ArgumentValueTypeName.STRING:
          notesItems.push(`string value`);
          break;
        case ArgumentValueTypeName.INTEGER:
          notesItems.push(`integer value`);
          break;
        case ArgumentValueTypeName.NUMBER:
          notesItems.push(`number value`);
          break;
        case ArgumentValueTypeName.BOOLEAN:
          notesItems.push(`boolean value`);
          break;
      }
    }
  }
  if (option.defaultValue !== undefined) {
    notesItems.push(
      `default: ${
        Array.isArray(option.defaultValue)
          ? `${option.defaultValue.join(", ")}`
          : `${option.defaultValue}`
      }`,
    );
  }

  if (option.isOptional) {
    notesItems.push("optional");
  }
  if (option.isArray) {
    notesItems.push("array");
  }

  if (option.type !== ComplexValueTypeName.COMPLEX) {
    const configurationKey = getConfigurationKey(
      cliConfig,
      command,
      [...(optionAncestry as Array<Argument>), option as unknown as Argument],
    );
    if (configurationKey !== undefined) {
      notesItems.push(`env var: ${configurationKey}`);
    }
  }

  let description = option.description || "";

  if (description.length > 0) {
    if (notesItems.length > 0) {
      description = `${description} (${notesItems.join(", ")})`;
    }
  } else if (notesItems.length > 0) {
    description = "(" + notesItems.join(", ") + ")";
  }

  return {
    syntax: `${optionCharacters}${option.name}${
      (option.shortAlias !== undefined)
        ? `, ${aliasCharacter}${option.shortAlias}`
        : ""
    }`,
    description,
    subEntryIndent: newSubEntryIndent,
    helpSubEntries: subEntries,
  };
}

function getPositionalHelpEntry(
  cliConfig: CLIConfig,
  command: Command,
  positional: Positional,
): HelpEntry {
  const notesItems: Array<string> = [];
  if (
    (positional.allowableValues !== undefined) &&
    (positional.allowableValues.length > 0)
  ) {
    notesItems.push(`valid values: ${positional.allowableValues.join("|")}`);
  } else {
    switch (positional.type) {
      case ArgumentValueTypeName.STRING:
        notesItems.push(`string value`);
        break;
      case ArgumentValueTypeName.INTEGER:
        notesItems.push(`integer value`);
        break;
      case ArgumentValueTypeName.NUMBER:
        notesItems.push(`number value`);
        break;
      case ArgumentValueTypeName.BOOLEAN:
        notesItems.push(`boolean value`);
        break;
    }
  }

  if (positional.isVarargOptional) {
    notesItems.push("optional");
  }
  if (positional.isVarargMultiple) {
    notesItems.push("array");
  }

  const configurationKey = getConfigurationKey(cliConfig, command, [
    positional,
  ]);
  if (configurationKey !== undefined) {
    notesItems.push(`env var: ${configurationKey}`);
  }

  let description = positional.description || "";

  if (description.length > 0) {
    if (notesItems.length > 0) {
      description = `${description} (${notesItems.join(", ")})`;
    }
  } else if (notesItems.length > 0) {
    description = "(" + notesItems.join(", ") + ")";
  }
  return {
    syntax: `<${positional.name}>`,
    description,
  };
}

export function getCommandArgsHelpSections(
  cliConfig: CLIConfig,
  subCommand: SubCommand,
  isSingleCommandApp: boolean,
): Array<HelpSection> {
  const helpSections: Array<HelpSection> = [];
  if ((subCommand.options.length > 0) || (subCommand.positionals.length > 0)) {
    const argumentsSection: HelpSection = {
      title: `${isSingleCommandApp ? "Command " : ""}Arguments`,
      helpEntries: [],
    };
    subCommand.options.forEach((option) => {
      argumentsSection.helpEntries.push(
        getOptionHelpEntry(cliConfig, subCommand, option as Option),
      );
    });
    subCommand.positionals.forEach((positional) => {
      argumentsSection.helpEntries.push(
        getPositionalHelpEntry(cliConfig, subCommand, positional),
      );
    });
    helpSections.push(argumentsSection);
  }
  return helpSections;
}
export function getCommandExamplesHelpSections(
  printer: Printer,
  context: Context,
  subCommand: SubCommand,
): Array<HelpSection> {
  const helpSections: Array<HelpSection> = [];
  if (
    (subCommand.usageExamples !== undefined) &&
    (subCommand.usageExamples.length > 0)
  ) {
    const usageSection: HelpSection = {
      title: subCommand.usageExamples.length > 1 ? "Examples" : "Example",
      helpEntries: [],
    };
    helpSections.push(usageSection);
    subCommand.usageExamples.forEach((usageExample: UsageExample, index) => {
      if (
        (usageExample.description != null) &&
        (usageExample.description.length > 0)
      ) {
        usageSection.helpEntries.push({
          syntax: `${printer.italic(usageExample.description)}:\n`,
        });
      }
      usageSection.helpEntries.push({
        syntax:
          `$ ${context.cliConfig.name} ${subCommand.name} ${usageExample.exampleArguments}`,
      });
      if (usageExample.output !== undefined) {
        usageExample.output.forEach((output) => {
          usageSection.helpEntries.push({
            syntax: printer.secondary(output),
          });
        });
      }
      if (index < subCommand.usageExamples!.length - 1) {
        usageSection.helpEntries.push({
          syntax: "",
        });
      }
    });
  }
  return helpSections;
}

export function getMultiCommandAppSyntax(
  context: Context,
  globalModifierCommands: ReadonlyArray<GlobalModifierCommand>,
  globalCommands: ReadonlyArray<GlobalCommand>,
  groupCommands: ReadonlyArray<GroupCommand>,
  subCommands: ReadonlyArray<SubCommand>,
): string {
  const globalPrefix = ((groupCommands.length > 0) || (subCommands.length > 0))
    ? "global_"
    : "";
  let syntax = context.cliConfig.name || "";
  if (globalModifierCommands.length > 0) {
    syntax += ` [<${globalPrefix}option>`;
    // dont render global_option arg if none defined
    const noArg = globalModifierCommands.every((
      modifier,
    ) => (modifier.argument === undefined));
    if (!noArg) {
      // render global_option arg in [] if all modifiers have non-optional, non-boolean arg with no default
      const optionArgMandatory = globalModifierCommands.every((modifier) =>
        (modifier.argument !== undefined) &&
        !modifier.argument.isOptional &&
        (modifier.argument.defaultValue === undefined) &&
        modifier.argument.type !== ArgumentValueTypeName.BOOLEAN
      );
      syntax += optionArgMandatory ? " <value>" : " [<value>]";
    }
    syntax += "]";
  }
  if (globalModifierCommands.length > 1) {
    syntax += "...";
  }
  let arg = false;
  let argOptional = false;
  let argValueOptional = false;
  let multipleArg = false;
  const commandClauses = [];
  if (globalCommands.length > 0) {
    commandClauses.push(`<${globalPrefix}command>`);
    arg = globalCommands.some((
      globalCommand,
    ) => (globalCommand.argument !== undefined));
    if (arg) {
      argOptional = globalCommands.some((globalCommand) =>
        (globalCommand.argument !== undefined) &&
        (((globalCommand.argument.isOptional !== undefined) &&
          globalCommand.argument.isOptional) ||
          (globalCommand.argument.defaultValue !== undefined))
      );
      argValueOptional = globalCommands.some((globalCommand) =>
        (globalCommand.argument !== undefined) &&
        (globalCommand.argument.type === ArgumentValueTypeName.BOOLEAN)
      );
    }
  }
  if ((groupCommands.length > 0) || (subCommands.length > 0)) {
    commandClauses.push("<command>");
    arg = arg || groupCommands.some((groupCommand) =>
      groupCommand.memberSubCommands.some((memberCommand) =>
        memberCommand.options.length > 0 || memberCommand.positionals.length > 0
      )
    ) ||
      subCommands.some((subCommand) =>
        subCommand.options.length > 0 || subCommand.positionals.length > 0
      );
    if (arg) {
      argOptional = argOptional || groupCommands.some((groupCommand) =>
        groupCommand.memberSubCommands.some((memberCommand) =>
          memberCommand.options.some((option) =>
            ((option.isOptional !== undefined) && option.isOptional) ||
            (option.defaultValue !== undefined)
          ) ||
          memberCommand.positionals.some((
            positional,
          ) => ((positional.isVarargOptional !== undefined) &&
            positional.isVarargOptional)
          )
        )
      ) ||
        subCommands.some((subCommand) =>
          subCommand.options.some((option) =>
            ((option.isOptional !== undefined) && option.isOptional) ||
            (option.defaultValue !== undefined)
          ) ||
          subCommand.positionals.some((
            positional,
          ) => ((positional.isVarargOptional !== undefined) &&
            positional.isVarargOptional)
          )
        );
      argValueOptional = argValueOptional ||
        groupCommands.some((groupCommand) =>
          groupCommand.memberSubCommands.some((memberCommand) =>
            memberCommand.options.some((option) =>
              option.type === ArgumentValueTypeName.BOOLEAN ||
              memberCommand.positionals.some((positional) =>
                positional.type === ArgumentValueTypeName.BOOLEAN
              )
            )
          )
        ) ||
        subCommands.some((subCommand) =>
          subCommand.options.some((option) =>
            option.type ===
              ArgumentValueTypeName.BOOLEAN
          ) ||
          subCommand.positionals.some((positional) =>
            positional.type === ArgumentValueTypeName.BOOLEAN
          )
        );
      multipleArg = multipleArg || groupCommands.some((groupCommand) =>
        groupCommand.memberSubCommands.some((memberCommand) =>
          memberCommand.options.some((option) =>
            option.isArray
          ) ||
          memberCommand.positionals.some((positional) =>
            positional.isVarargMultiple
          )
        )
      ) ||
        subCommands.some((subCommand) =>
          subCommand.options.some((option) =>
            option.isArray
          ) ||
          subCommand.positionals.some((positional) =>
            positional.isVarargMultiple
          )
        );
    }
  }
  if (commandClauses.length > 0) {
    let subSyntax = `${commandClauses.join("|")}`;
    // dont render arg if none defined (no global arg or no option/positional)
    if (arg) {
      let argSyntax = "<arg>";
      // render arg value in [] if some are optional
      argSyntax += argValueOptional ? " [<value>]" : " <value>";
      // dont render arg in [] if none are optional and have no default
      subSyntax += argOptional
        ? ` [${argSyntax}]`
        : multipleArg
        ? ` <${argSyntax}>`
        : ` ${argSyntax}`;
      // check to render multiple arg
      if (multipleArg) {
        subSyntax += "...";
      }
    }
    syntax += ` ${subSyntax}`;
  }
  return syntax;
}
