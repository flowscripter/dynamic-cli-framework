import DefaultCommandRegistry from "../../src/runtime/registry/DefaultCommandRegistry.ts";
import type Command from "../../src/api/command/Command.ts";

export function getCommandRegistry(
  commands?: Array<Command>,
): DefaultCommandRegistry {
  return new DefaultCommandRegistry(commands);
}
