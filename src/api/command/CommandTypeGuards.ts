import SubCommand from "./SubCommand.ts";
import GroupCommand from "./GroupCommand.ts";
import GlobalCommand from "./GlobalCommand.ts";
import GlobalModifierCommand from "./GlobalModifierCommand.ts";
import Command from "./Command.ts";

export function isGroupCommand(
  command: Command,
): command is GroupCommand {
  return (command as GroupCommand).memberSubCommands !== undefined;
}

export function isSubCommand(
  command: Command,
): command is SubCommand {
  return (command as SubCommand).options !== undefined;
}

export function isGlobalModifierCommand(
  command: Command,
): command is GlobalModifierCommand {
  return (command as GlobalModifierCommand).executePriority !== undefined;
}

export function isGlobalCommand(
  command: Command,
): command is GlobalCommand {
  return !isGroupCommand(command) && !isSubCommand(command) &&
    !isGlobalModifierCommand(command);
}
