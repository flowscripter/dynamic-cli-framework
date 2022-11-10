import SubCommand from "./SubCommand.ts";
import GroupCommand from "./GroupCommand.ts";
import GlobalCommand from "./GlobalCommand.ts";
import GlobalModifierCommand from "./GlobalModifierCommand.ts";
import { NonModifierCommand } from "./NonModifierCommand.ts";

export function isGroupCommand(
  command: SubCommand | GroupCommand | GlobalCommand | GlobalModifierCommand,
): command is GroupCommand {
  return (command as GroupCommand).memberSubCommands !== undefined;
}

export function isSubCommand(
  command: SubCommand | GroupCommand | GlobalCommand | GlobalModifierCommand,
): command is SubCommand {
  return (command as SubCommand).options !== undefined;
}

export function isGlobalModifierCommand(
  command: SubCommand | GroupCommand | GlobalCommand | GlobalModifierCommand,
): command is GlobalModifierCommand {
  return (command as GlobalModifierCommand).executePriority !== undefined;
}

export function isGlobalCommand(
  command: SubCommand | GroupCommand | GlobalCommand | GlobalModifierCommand,
): command is GlobalCommand {
  return !isGroupCommand(command) && !isSubCommand(command) &&
    !isGlobalModifierCommand(command);
}

export function isNonModifierCommand(
  command: SubCommand | GroupCommand | GlobalCommand | GlobalModifierCommand,
): command is NonModifierCommand {
  return isSubCommand(command) || isGlobalCommand(command) ||
    isGroupCommand(command);
}
