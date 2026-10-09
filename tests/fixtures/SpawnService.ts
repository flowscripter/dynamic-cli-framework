import type {
  SpawnOptions,
  SpawnResult,
  SpawnService,
} from "@flowscripter/dynamic-cli-framework-api";
export interface SpawnCall {
  command: ReadonlyArray<string>;
  options?: SpawnOptions;
}

// Records every spawn() call, feeds the output lines for a command through onOutput when the
// handler provides them, and returns the handler's result.
export function getSpawnService(
  handler: (command: ReadonlyArray<string>) => SpawnResult,
  outputFor: (command: ReadonlyArray<string>) => ReadonlyArray<string> = () => [],
): { spawnService: SpawnService; calls: SpawnCall[] } {
  const calls: SpawnCall[] = [];
  const spawnService = {
    spawn: (command: ReadonlyArray<string>, options?: SpawnOptions) => {
      calls.push({ command, options });
      if (options && "onOutput" in options && typeof options.onOutput === "function") {
        for (const line of outputFor(command)) {
          options.onOutput(line, "stdout");
        }
      }
      return Promise.resolve(handler(command));
    },
  } as unknown as SpawnService;
  return { spawnService, calls };
}
