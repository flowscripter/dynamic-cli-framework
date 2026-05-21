import type CompletionService from "../../api/service/core/CompletionService.ts";
import {
  type CompletionItem,
  ShellType,
} from "../../api/service/core/CompletionService.ts";
import type CommandRegistry from "../../runtime/registry/CommandRegistry.ts";
import type ShellHandler from "./shell/ShellHandler.ts";
import BashShellHandler from "./shell/bash.ts";
import ZshShellHandler from "./shell/zsh.ts";
import FishShellHandler from "./shell/fish.ts";
import PowerShellShellHandler from "./shell/powershell.ts";
import type SubCommand from "../../api/command/SubCommand.ts";
import type Option from "../../api/argument/Option.ts";

export default class DefaultCompletionService implements CompletionService {
  #commandRegistry: CommandRegistry | undefined;

  readonly #shellHandlers: Map<ShellType, ShellHandler> = new Map([
    [ShellType.BASH, new BashShellHandler()],
    [ShellType.ZSH, new ZshShellHandler()],
    [ShellType.FISH, new FishShellHandler()],
    [ShellType.POWERSHELL, new PowerShellShellHandler()],
  ]);

  setCommandRegistry(registry: CommandRegistry): void {
    this.#commandRegistry = registry;
  }

  getBootstrapScript(shellType: ShellType, cliName: string): string {
    return this.#getHandler(shellType).getBootstrapScript(cliName);
  }

  getDefaultConfigPath(shellType: ShellType): string {
    return this.#getHandler(shellType).getDefaultConfigPath();
  }

  validateShellEnvironment(shellType: ShellType): Promise<boolean> {
    return this.#getHandler(shellType).validateEnvironment();
  }

  formatCompletions(
    shellType: ShellType,
    completions: ReadonlyArray<CompletionItem>,
  ): string {
    return this.#getHandler(shellType).formatCompletions(completions);
  }

  parseCompletionContext(
    shell: ShellType,
    args: ReadonlyArray<string>,
  ): { line: string; cursorPosition: number } {
    return this.#getHandler(shell).parseCompletionContext(args);
  }

  generateCompletions(
    _shellType: ShellType,
    line: string,
    cursorPosition: number,
  ): Promise<ReadonlyArray<CompletionItem>> {
    if (!this.#commandRegistry) {
      return Promise.resolve([]);
    }

    const beforeCursor = line.substring(0, cursorPosition);
    const words = this.#tokenize(beforeCursor);

    // Remove CLI name (first word)
    const relevantWords = words.slice(1);
    const currentWord = relevantWords[relevantWords.length - 1] ?? "";
    const previousWords = relevantWords.slice(0, -1);
    const endsWithSpace = beforeCursor.endsWith(" ");

    if (
      relevantWords.length === 0 ||
      (relevantWords.length === 1 && !endsWithSpace)
    ) {
      return Promise.resolve(this.#completeCommandName(currentWord));
    }

    if (endsWithSpace) {
      const commandWord = relevantWords[0]!;
      return Promise.resolve(
        this.#completeAfterCommand(commandWord, relevantWords.slice(1), ""),
      );
    }

    const commandWord = previousWords[0];
    if (commandWord) {
      return Promise.resolve(
        this.#completeAfterCommand(
          commandWord,
          previousWords.slice(1),
          currentWord,
        ),
      );
    }

    return Promise.resolve(this.#completeCommandName(currentWord));
  }

  #completeAfterCommand(
    commandWord: string,
    intermediateWords: ReadonlyArray<string>,
    currentWord: string,
  ): ReadonlyArray<CompletionItem> {
    // Check for group:member pattern
    if (commandWord.includes(":")) {
      const result = this.#commandRegistry!
        .getGroupCommandAndMemberSubCommandByJoinedName(commandWord);
      if (result) {
        return this.#completeSubCommandArgs(
          result.command,
          intermediateWords,
          currentWord,
        );
      }
    }

    // Check if partial group:member (e.g. "completions:" completing member)
    if (currentWord.includes(":")) {
      const colonIdx = currentWord.indexOf(":");
      const groupPart = currentWord.substring(0, colonIdx);
      const groupCommand = this.#commandRegistry!.getGroupCommandByName(
        groupPart,
      );
      if (groupCommand) {
        return groupCommand.memberSubCommands
          .filter((sc) => `${groupPart}:${sc.name}`.startsWith(currentWord))
          .map((sc) => ({
            value: `${groupPart}:${sc.name}`,
            description: sc.description,
          }));
      }
    }

    // Check sub-command
    const subCommand = this.#commandRegistry!.getSubCommandByName(commandWord);
    if (subCommand) {
      return this.#completeSubCommandArgs(
        subCommand,
        intermediateWords,
        currentWord,
      );
    }

    // Check group command (suggest members)
    const groupCommand = this.#commandRegistry!.getGroupCommandByName(
      commandWord,
    );
    if (groupCommand) {
      return groupCommand.memberSubCommands
        .filter((sc) => sc.name.startsWith(currentWord))
        .map((sc) => ({
          value: `${commandWord}:${sc.name}`,
          description: sc.description,
        }));
    }

    return this.#completeCommandName(currentWord);
  }

  #completeCommandName(prefix: string): ReadonlyArray<CompletionItem> {
    const completions: CompletionItem[] = [];

    // Sub-commands
    const subCommands = this.#commandRegistry!.getSubCommands();
    for (const cmd of subCommands) {
      if (cmd.name.startsWith(prefix)) {
        completions.push({ value: cmd.name, description: cmd.description });
      }
    }

    // Group:member joined names
    const groupAndMembers = this.#commandRegistry!
      .getGroupAndMemberCommandsByJoinedName();
    for (const [joinedName, entry] of groupAndMembers) {
      if (joinedName.startsWith(prefix)) {
        completions.push({
          value: joinedName,
          description: entry.command.description,
        });
      }
    }

    // Group command names (to suggest further typing "group:")
    const groupCommands = this.#commandRegistry!.getGroupCommands();
    for (const cmd of groupCommands) {
      if (cmd.name.startsWith(prefix) && !prefix.includes(":")) {
        completions.push({
          value: cmd.name,
          description: cmd.description,
        });
      }
    }

    // Global commands (with -- prefix)
    const globalCommands = this.#commandRegistry!.getGlobalCommands();
    for (const cmd of globalCommands) {
      const prefixed = `--${cmd.name}`;
      if (prefixed.startsWith(prefix)) {
        completions.push({ value: prefixed, description: cmd.description });
      }
    }

    // Global modifier commands (with -- prefix)
    const modifierCommands = this.#commandRegistry!
      .getGlobalModifierCommands();
    for (const cmd of modifierCommands) {
      const prefixed = `--${cmd.name}`;
      if (prefixed.startsWith(prefix)) {
        completions.push({ value: prefixed, description: cmd.description });
      }
    }

    return completions;
  }

  #completeSubCommandArgs(
    subCommand: SubCommand,
    previousArgs: ReadonlyArray<string>,
    currentWord: string,
  ): ReadonlyArray<CompletionItem> {
    const completions: CompletionItem[] = [];

    // If current word starts with --, complete option names
    if (currentWord.startsWith("--")) {
      const prefix = currentWord.substring(2);
      for (const opt of subCommand.options) {
        if ("name" in opt && (opt as Option).name.startsWith(prefix)) {
          completions.push({
            value: `--${(opt as Option).name}`,
            description: (opt as Option).description,
          });
        }
      }
      return completions;
    }

    // If current word starts with -, complete short aliases
    if (currentWord.startsWith("-") && currentWord.length <= 2) {
      for (const opt of subCommand.options) {
        if ("shortAlias" in opt && (opt as Option).shortAlias) {
          const alias = `-${(opt as Option).shortAlias}`;
          if (alias.startsWith(currentWord)) {
            completions.push({
              value: alias,
              description: (opt as Option).description,
            });
          }
        }
      }
      return completions;
    }

    // Check if previous word was an option expecting a value
    const lastPrevWord = previousArgs[previousArgs.length - 1];
    if (lastPrevWord && lastPrevWord.startsWith("--")) {
      const optName = lastPrevWord.substring(2);
      const option = subCommand.options.find(
        (o) => "name" in o && (o as Option).name === optName,
      ) as Option | undefined;
      if (option && option.allowableValues) {
        return option.allowableValues
          .filter((v) => String(v).startsWith(currentWord))
          .map((v) => ({ value: String(v) }));
      }
    }

    // Suggest options that haven't been used
    for (const opt of subCommand.options) {
      if ("name" in opt) {
        const optName = `--${(opt as Option).name}`;
        if (
          !previousArgs.includes(optName) && optName.startsWith(currentWord)
        ) {
          completions.push({
            value: optName,
            description: (opt as Option).description,
          });
        }
      }
    }

    // Suggest positional allowable values
    const positionalIndex = this.#countPositionalArgs(
      previousArgs,
      subCommand,
    );
    if (positionalIndex < subCommand.positionals.length) {
      const positional = subCommand.positionals[positionalIndex]!;
      if (positional.allowableValues) {
        for (const v of positional.allowableValues) {
          if (String(v).startsWith(currentWord)) {
            completions.push({ value: String(v) });
          }
        }
      }
    }

    return completions;
  }

  #countPositionalArgs(
    args: ReadonlyArray<string>,
    subCommand: SubCommand,
  ): number {
    let count = 0;
    let i = 0;
    while (i < args.length) {
      const arg = args[i]!;
      if (arg.startsWith("-")) {
        // Skip option and its value
        const optName = arg.startsWith("--") ? arg.substring(2) : undefined;
        const option = optName
          ? subCommand.options.find(
            (o) => "name" in o && (o as Option).name === optName,
          )
          : undefined;
        if (option && option.type !== undefined) {
          i++; // skip the option value
        }
      } else {
        count++;
      }
      i++;
    }
    return count;
  }

  #tokenize(input: string): string[] {
    const words: string[] = [];
    let current = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i]!;
      if (ch === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (ch === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      } else if (ch === " " && !inSingleQuote && !inDoubleQuote) {
        if (current.length > 0) {
          words.push(current);
          current = "";
        }
      } else {
        current += ch;
      }
    }
    if (current.length > 0) {
      words.push(current);
    }
    return words;
  }

  #getHandler(shellType: ShellType): ShellHandler {
    const handler = this.#shellHandlers.get(shellType);
    if (!handler) {
      throw new Error(`Unsupported shell type: ${shellType}`);
    }
    return handler;
  }
}
