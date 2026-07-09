import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GroupCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Command } from "@flowscripter/dynamic-cli-framework-api";

export function isGroupCommand(command: Command): command is GroupCommand {
  return (command as GroupCommand).memberSubCommands !== undefined;
}

export function isSubCommand(command: Command): command is SubCommand {
  return (command as SubCommand).options !== undefined;
}

export function isGlobalModifierCommand(command: Command): command is GlobalModifierCommand {
  return (command as GlobalModifierCommand).executePriority !== undefined;
}

export function isGlobalCommand(command: Command): command is GlobalCommand {
  return !isGroupCommand(command) && !isSubCommand(command) && !isGlobalModifierCommand(command);
}
