import { Buffer } from "https://deno.land/std@0.161.0/io/buffer.ts";
import { Context } from "../../mod.ts";
import DefaultContext from "../../src/runtime/DefaultContext.ts";
import DefaultPrinter from "../../src/service/core/DefaultPrinter.ts";
import { PRINTER_SERVICE_ID } from "../../src/api/service/core/Printer.ts";
import { CONFIGURATION_SERVICE_ID } from "../../src/api/service/core/Configuration.ts";
import DefaultConfiguration from "../../src/service/core/DefaultConfiguration.ts";
import ConfigurationService from "../../src/service/core/ConfigurationService.ts";
import { getCLIConfig } from "./CLIConfig.ts";

export function getContext(buffer: Buffer): Context {
  const defaultContext = new DefaultContext(getCLIConfig());
  const defaultPrinter = new DefaultPrinter(buffer, buffer);

  defaultPrinter.colorEnabled = false;
  defaultContext.addServiceInstance(PRINTER_SERVICE_ID, defaultPrinter);
  defaultContext.addServiceInstance(
    CONFIGURATION_SERVICE_ID,
    new DefaultConfiguration(new ConfigurationService(100)),
  );

  return defaultContext;
}
