import { Command } from "../../mod.ts";
import DefaultCommandRegistry from "../../src/registry/DefaultCommandRegistry.ts";

export function getCommandRegistry(
  commands?: Array<Command>,
): DefaultCommandRegistry {
  return new DefaultCommandRegistry(commands);
}
