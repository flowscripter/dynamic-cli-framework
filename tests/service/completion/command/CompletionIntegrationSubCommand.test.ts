import { describe, expect, test } from "bun:test";
import { CompletionIntegrationSubCommand } from "../../../../src/service/completion/command/CompletionIntegrationSubCommand.ts";
import type { CompletionService, PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import {
  COMPLETION_SERVICE_ID,
  PRINTER_SERVICE_ID,
  ShellType,
} from "@flowscripter/dynamic-cli-framework-api";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

describe("CompletionIntegrationSubCommand", () => {
  test("has correct name", () => {
    const cmd = new CompletionIntegrationSubCommand();
    expect(cmd.name).toEqual("integration");
  });

  test("has shell positional with allowable values", () => {
    const cmd = new CompletionIntegrationSubCommand();
    expect(cmd.positionals.length).toEqual(1);
    expect(cmd.positionals[0]!.name).toEqual("shell");
    expect(cmd.positionals[0]!.allowableValues).toEqual(["bash", "zsh", "fish", "powershell"]);
  });

  test("has optional config-path option", () => {
    const cmd = new CompletionIntegrationSubCommand();
    expect(cmd.options.length).toEqual(1);
    expect(cmd.options[0]!.name).toEqual("config-path");
    expect(cmd.options[0]!.isOptional).toEqual(true);
  });

  test("execute uses any CompletionService from the context", async () => {
    const dir = await mkdtemp(join(tmpdir(), "completion-integration-"));
    try {
      const configPath = join(dir, "rc");
      const printed: string[] = [];
      const cmd = new CompletionIntegrationSubCommand();

      await cmd.execute(getContext(getMockCompletionService(), printed), {
        shell: ShellType.BASH,
        "config-path": configPath,
      });

      const content = await Bun.file(configPath).text();
      expect(content).toContain(`bootstrap bash ${getCLIConfig().name}`);
      expect(printed.length).toEqual(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
