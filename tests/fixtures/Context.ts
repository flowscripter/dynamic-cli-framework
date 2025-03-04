import DefaultContext from "../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "./CLIConfig.ts";
import { PRINTER_SERVICE_ID } from "../../src/api/service/core/PrinterService.ts";
import DefaultPrinterService from "../../src/service/printer/DefaultPrinterService.ts";
import DefaultKeyValueService from "../../src/service/configuration/DefaultKeyValueService.ts";
import { KEY_VALUE_SERVICE_ID } from "../../src/api/service/core/KeyValueService.ts";
import type Context from "../../src/api/Context.ts";
import WritableStreamString from "./StreamString.ts";
import TtyTerminal from "../../src/service/printer/terminal/TtyTerminal.ts";
import TtyStyler from "../../src/service/printer/terminal/TtyStyler.ts";

export function getContext(
  streamString: WritableStreamString,
): Context {
  const defaultContext = new DefaultContext(getCLIConfig());
  const defaultPrinterService = new DefaultPrinterService(
    streamString.writableStream,
    streamString.writableStream,
    false,
    false,
    new TtyTerminal(streamString.writeStream),
    new TtyStyler(),
  );

  defaultPrinterService.colorEnabled = false;
  defaultContext.addServiceInstance(PRINTER_SERVICE_ID, defaultPrinterService);
  defaultContext.addServiceInstance(
    KEY_VALUE_SERVICE_ID,
    new DefaultKeyValueService(),
  );

  return defaultContext;
}
