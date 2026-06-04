import { describe, expect, test } from "bun:test";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import DumpConfigCommand from "../../../../src/service/configuration/command/DumpConfigCommand.ts";
import ConfigurationServiceProvider from "../../../../src/service/configuration/ConfigurationServiceProvider.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import {
  PRINTER_SERVICE_ID,
} from "../../../../src/api/service/core/PrinterService.ts";
import {
  SYNTAX_HIGHLIGHTER_SERVICE_ID,
} from "../../../../src/api/service/core/SyntaxHighlighterService.ts";

describe("DumpConfigCommand tests", () => {
  test("has correct name and description", () => {
    const configProvider = new ConfigurationServiceProvider(90, false, true);
    const command = new DumpConfigCommand(configProvider);

    expect(command.name).toEqual("dump-config");
    expect(command.description).toEqual("Dump configuration values");
  });

  test("execute prints highlighted config string", async () => {
    const configProvider = new ConfigurationServiceProvider(90, false, true);
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);

    let printedMessage = "";
    const mockPrinterService = {
      print: (message: string) => {
        printedMessage = message;
        return Promise.resolve();
      },
    };

    let highlightedText = "";
    let highlightedLang = "";
    const mockSyntaxHighlighter = {
      highlight: (text: string, language: string) => {
        highlightedText = text;
        highlightedLang = language;
        return `highlighted:${text}`;
      },
    };

    context.addServiceInstance(PRINTER_SERVICE_ID, mockPrinterService);
    context.addServiceInstance(
      SYNTAX_HIGHLIGHTER_SERVICE_ID,
      mockSyntaxHighlighter,
    );

    const command = new DumpConfigCommand(configProvider);
    await command.execute(context);

    expect(highlightedLang).toEqual("json");
    expect(highlightedText).toEqual(configProvider.getConfigString());
    expect(printedMessage).toEqual(
      `highlighted:${configProvider.getConfigString()}\n`,
    );
  });
});
