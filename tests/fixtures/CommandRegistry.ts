import DefaultCommandRegistry from "../../src/runtime/registry/DefaultCommandRegistry.ts";
import type { Command } from "@flowscripter/dynamic-cli-framework-api";

export function getCommandRegistry(commands?: Array<Command>): DefaultCommandRegistry {
  return new DefaultCommandRegistry(commands);
}
