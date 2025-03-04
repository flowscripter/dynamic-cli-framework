import type SubCommand from "../../api/command/SubCommand.ts";
import type GroupCommand from "../../api/command/GroupCommand.ts";
import type GlobalCommand from "../../api/command/GlobalCommand.ts";
import type GlobalModifierCommand from "../../api/command/GlobalModifierCommand.ts";
import type Command from "../../api/command/Command.ts";

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
