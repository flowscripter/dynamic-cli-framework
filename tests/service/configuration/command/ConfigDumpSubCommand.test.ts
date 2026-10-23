import { describe, expect, test } from "bun:test";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import DefaultConfigurationService from "../../../../src/service/configuration/DefaultConfigurationService.ts";
import jsonFormat from "../../../../src/service/configuration/format/JsonConfigFormat.ts";
import ConfigDumpSubCommand from "../../../../src/service/configuration/command/ConfigDumpSubCommand.ts";
import ConfigurationServiceProvider from "../../../../src/service/configuration/ConfigurationServiceProvider.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { SYNTAX_HIGHLIGHTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";

describe("ConfigDumpSubCommand tests", () => {
  test("has correct name and description", () => {
    const command = new ConfigDumpSubCommand(new DefaultConfigurationService(false, jsonFormat));

    expect(command.name).toEqual("dump");
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
    context.addServiceInstance(SYNTAX_HIGHLIGHTER_SERVICE_ID, mockSyntaxHighlighter);
    const { service } = await configProvider.getServiceInfo(cliConfig);

    const command = new ConfigDumpSubCommand(service as DefaultConfigurationService);
    await command.execute(context);

    expect(highlightedLang).toEqual("json");
    expect(highlightedText).toEqual(configProvider.getConfigString());
    expect(printedMessage).toEqual(`highlighted:${configProvider.getConfigString()}\n`);
  });
});
