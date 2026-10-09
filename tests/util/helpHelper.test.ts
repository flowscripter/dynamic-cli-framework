import { describe, expect, test } from "bun:test";
import { ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type {
  CLIConfig,
  GlobalCommand,
  PrinterService,
  TableGeneratorService,
} from "@flowscripter/dynamic-cli-framework-api";
import {
  getCommandArgsHelpSections,
  getGlobalArgumentHelpEntry,
  printHelpSections,
} from "../../src/util/helpHelper.ts";
import type { HelpSection } from "../../src/util/helpHelper.ts";
import { getSubCommand } from "../fixtures/Command.ts";

const cliConfig = { name: "cli" } as CLIConfig;

async function render(sections: Array<HelpSection>): Promise<string> {
  let out = "";
  const printerService = {
    stdoutColumns: () => 80,
    emphasised: (m: string) => `<e>${m}</e>`,
    primary: (m: string) => `<p>${m}</p>`,
    secondary: (m: string) => `<s>${m}</s>`,
    print: async (m: string) => {
      out += m;
    },
  } as unknown as PrinterService;
  const cells: Array<string> = [];
  const tableGeneratorService = {
    createTable: () => ({
      column: () => {},
      cell: (_r: number, _c: number, v: string) => cells.push(v),
    }),
    render: () => cells.join("|"),
  } as unknown as TableGeneratorService;
  await printHelpSections(printerService, tableGeneratorService, sections);
  return out;
}

describe("helpHelper tests", () => {
  test("valid values and default value of an option are rendered as user input", async () => {
    const subCommand = getSubCommand("sub", [
      {
        name: "level",
        type: ValueTypeName.STRING,
        allowableValues: ["DEBUG", "INFO"],
        defaultValue: "INFO",
      },
    ]);
    const out = await render(getCommandArgsHelpSections(cliConfig, false, subCommand, false));
    expect(out).toContain(
      "<s>(valid values: </s><p>DEBUG|INFO</p><s>, default: </s><p>INFO</p><s>)</s>",
    );
  });

  test("array default value of an option is rendered as user input", async () => {
    const subCommand = getSubCommand("sub", [
      { name: "tags", type: ValueTypeName.STRING, isArray: true, defaultValue: ["a", "b"] },
    ]);
    const out = await render(getCommandArgsHelpSections(cliConfig, false, subCommand, false));
    expect(out).toContain("default: </s><p>a, b</p><s>, array)");
  });

  test("valid values of a positional are rendered as user input", async () => {
    const subCommand = getSubCommand(
      "sub",
      [],
      [{ name: "mode", type: ValueTypeName.STRING, allowableValues: ["x", "y"] }],
    );
    const out = await render(getCommandArgsHelpSections(cliConfig, false, subCommand, false));
    expect(out).toContain("<s>(valid values: </s><p>x|y</p><s>)</s>");
  });

  test("valid values and default value of a global argument are rendered as user input", async () => {
    const globalCommand = {
      name: "banner",
      description: "Disable output of banner",
      argument: { type: ValueTypeName.BOOLEAN, defaultValue: true },
      execute: async () => {},
    } as unknown as GlobalCommand;
    const entry = getGlobalArgumentHelpEntry(cliConfig, false, globalCommand);
    const out = await render([{ title: "", helpEntries: [entry] }]);
    expect(out).toContain("<s>Disable output of banner (default: </s><p>true</p><s>)</s>");
  });
});
