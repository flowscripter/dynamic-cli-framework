import DefaultContext from "../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "./CLIConfig.ts";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultPrinterService from "../../src/service/printer/DefaultPrinterService.ts";
import DefaultKeyValueService from "../../src/service/configuration/DefaultKeyValueService.ts";
import { KEY_VALUE_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import WritableStreamString from "./StreamString.ts";
import TtyTerminal from "../../src/terminal/TtyTerminal.ts";
import TtyStyler from "../../src/terminal/TtyStyler.ts";
import { TABLE_GENERATOR_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import DefaultTableGeneratorService from "../../src/service/tableGenerator/DefaultTableGeneratorService.ts";

export function getContext(streamString: WritableStreamString): Context {
  const defaultContext = new DefaultContext(getCLIConfig());
  const defaultPrinterService = new DefaultPrinterService(
    streamString.writableStream,
    streamString.writableStream,
    false,
    false,
    new TtyTerminal(streamString.writeStream),
    new TtyTerminal(streamString.writeStream),
    new TtyStyler(3),
  );

  defaultPrinterService.colorEnabled = false;
  defaultContext.addServiceInstance(PRINTER_SERVICE_ID, defaultPrinterService);
  defaultContext.addServiceInstance(KEY_VALUE_SERVICE_ID, new DefaultKeyValueService());
  defaultContext.addServiceInstance(TABLE_GENERATOR_SERVICE_ID, new DefaultTableGeneratorService());

  return defaultContext;
}
