import SubCommand from "./SubCommand.ts";
import GlobalCommand from "./GlobalCommand.ts";
import GlobalModifierCommand from "./GlobalModifierCommand.ts";

/**
 * A type definition to include all {@link Command} types except
 * {@link GlobalModifierCommand} and {@link GroupCommand}.
 */
export type NonModifierCommand = Exclude<
  SubCommand | GlobalCommand,
  GlobalModifierCommand
>;
