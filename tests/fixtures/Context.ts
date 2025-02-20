import type { Buffer } from "@std/streams";
import DefaultContext from "../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "./CLIConfig.ts";
import { PRINTER_SERVICE_ID } from "../../src/api/service/core/PrinterService.ts";
import DefaultPrinterService from "../../src/service/printer/DefaultPrinterService.ts";
import DefaultKeyValueService from "../../src/service/configuration/DefaultKeyValueService.ts";
import { KEY_VALUE_SERVICE_ID } from "../../src/api/service/core/KeyValueService.ts";
import type Context from "../../src/api/Context.ts";

export function getContext(buffer: Buffer): Context {
  const defaultContext = new DefaultContext(getCLIConfig());
  const defaultPrinterService = new DefaultPrinterService(
    buffer.writable,
    buffer.writable,
  );

  defaultPrinterService.colorEnabled = false;
  defaultContext.addServiceInstance(PRINTER_SERVICE_ID, defaultPrinterService);
  defaultContext.addServiceInstance(
    KEY_VALUE_SERVICE_ID,
    new DefaultKeyValueService(),
  );

  return defaultContext;
}
