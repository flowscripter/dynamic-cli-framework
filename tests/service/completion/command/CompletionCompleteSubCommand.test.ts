import { describe, expect, test } from "bun:test";
import { CompletionCompleteSubCommand } from "../../../../src/service/completion/command/CompletionCompleteSubCommand.ts";
import type { CompletionService, PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import {
  COMPLETION_SERVICE_ID,
  PRINTER_SERVICE_ID,
  ShellType,
} from "@flowscripter/dynamic-cli-framework-api";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";

function getContext(completionService: CompletionService, printed: string[]): DefaultContext {
  const context = new DefaultContext(getCLIConfig());
  context.addServiceInstance(COMPLETION_SERVICE_ID, completionService);
  context.addServiceInstance(PRINTER_SERVICE_ID, {
    print: (m: string) => {
      printed.push(m);
      return Promise.resolve();
    },
    info: (m: string) => {
      printed.push(m);
      return Promise.resolve();
    },
    warn: (m: string) => {
      printed.push(m);
      return Promise.resolve();
    },
  } as unknown as PrinterService);
  return context;
}

function getMockCompletionService(): CompletionService {
  return {
    parseCompletionContext: (_shellType, args) => ({ line: args.join(" "), cursorPosition: 7 }),
    generateCompletions: (_shellType, line, cursorPosition) =>
      Promise.resolve([{ value: `${line}@${cursorPosition}` }]),
    getBootstrapScript: (shellType, cliName) => `bootstrap ${shellType} ${cliName}`,
    getDefaultConfigPath: () => "unused",
    validateShellEnvironment: () => Promise.resolve(true),
    formatCompletions: (_shellType, completions) => completions.map((c) => c.value).join("\n"),
  };
}

describe("CompletionCompleteSubCommand", () => {
  test("has correct name", () => {
    const cmd = new CompletionCompleteSubCommand();
    expect(cmd.name).toEqual("complete");
  });

  test("has shell positional and vararg args positional", () => {
    const cmd = new CompletionCompleteSubCommand();
    expect(cmd.positionals.length).toEqual(2);
    expect(cmd.positionals[0]!.name).toEqual("shell");
    expect(cmd.positionals[1]!.name).toEqual("args");
    expect(cmd.positionals[1]!.isVarargMultiple).toEqual(true);
    expect(cmd.positionals[1]!.isVarargOptional).toEqual(true);
  });

  test("execute uses any CompletionService from the context", async () => {
    const printed: string[] = [];
    const cmd = new CompletionCompleteSubCommand();

    await cmd.execute(getContext(getMockCompletionService(), printed), {
      shell: ShellType.BASH,
      args: ["cli", "foo"],
    });

    expect(printed).toEqual(["cli foo@7\n"]);
  });
});
